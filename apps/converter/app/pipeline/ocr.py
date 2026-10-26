"""Tesseract OCR (Khmer + English) for scanned pages and unrepairable text."""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from functools import lru_cache
from statistics import median

import fitz
from PIL import Image

from .. import khmer
from ..core import config


log = logging.getLogger(__name__)


OCR_LANG = config.OCR_LANG


OCR_DPI = config.OCR_DPI


@dataclass
class OcrLine:
    bbox: tuple[float, float, float, float]  # PDF points
    text: str

    @property
    def height(self) -> float:
        return self.bbox[3] - self.bbox[1]


@dataclass
class OcrBlock:
    bbox: tuple[float, float, float, float]
    lines: list[OcrLine]

    @property
    def text(self) -> str:
        out = ""
        for ln in self.lines:
            out = khmer.join_khmer_lines(out, ln.text)
        return out


@lru_cache(maxsize=1)
def available() -> bool:
    try:
        import pytesseract

        langs = set(pytesseract.get_languages(config=""))
        missing = [lang for lang in OCR_LANG.split("+") if lang not in langs]
        if missing:
            log.warning("tesseract is missing languages: %s", missing)
        return "khm" in langs or "eng" in langs
    except Exception as exc:  # tesseract binary missing
        log.warning("tesseract not available: %s", exc)
        return False


def _lang() -> str:
    import pytesseract

    langs = set(pytesseract.get_languages(config=""))
    return "+".join(lang for lang in OCR_LANG.split("+") if lang in langs) or "eng"


def ocr_page(page: fitz.Page, dpi: int = OCR_DPI) -> list[OcrBlock]:
    import pytesseract

    pix = page.get_pixmap(dpi=dpi, alpha=False, colorspace=fitz.csGRAY)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    data = pytesseract.image_to_data(
        img, lang=_lang(), config="--oem 1 --psm 3 -c preserve_interword_spaces=1",
        output_type=pytesseract.Output.DICT,
    )
    scale = 72.0 / dpi
    lines: dict[tuple[int, int, int], list[tuple[int, int, int, int, str]]] = {}
    for i, word in enumerate(data["text"]):
        word = (word or "").strip()
        if not word or float(data["conf"][i]) < 0:
            continue
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        lines.setdefault(key, []).append(
            (data["left"][i], data["top"][i], data["width"][i], data["height"][i], word)
        )

    blocks: dict[tuple[int, int], list[OcrLine]] = {}
    for (b, p, _), words in sorted(lines.items()):
        words.sort(key=lambda w: w[0])
        heights = [w[3] for w in words]
        h = median(heights) if heights else 10
        text = words[0][4]
        for prev, cur in zip(words, words[1:]):
            gap = cur[0] - (prev[0] + prev[2])
            # Tesseract splits Khmer into "words" that have no real space between them
            if khmer.is_khmer(prev[4][-1]) and khmer.is_khmer(cur[4][0]) and gap < 0.35 * h:
                text += cur[4]
            else:
                text += " " + cur[4]
        x0 = min(w[0] for w in words) * scale
        y0 = min(w[1] for w in words) * scale
        x1 = max(w[0] + w[2] for w in words) * scale
        y1 = max(w[1] + w[3] for w in words) * scale
        blocks.setdefault((b, p), []).append(OcrLine((x0, y0, x1, y1), text))

    out: list[OcrBlock] = []
    for lines_ in blocks.values():
        x0 = min(l.bbox[0] for l in lines_)
        y0 = min(l.bbox[1] for l in lines_)
        x1 = max(l.bbox[2] for l in lines_)
        y1 = max(l.bbox[3] for l in lines_)
        out.append(OcrBlock((x0, y0, x1, y1), lines_))
    out.sort(key=lambda b: (round(b.bbox[1] / 5), b.bbox[0]))
    return out


def ocr_line(page: fitz.Page, clip: fitz.Rect, dpi: int, invert: bool = False) -> str:
    """OCR one text line (single-line mode is far more accurate than page mode)."""
    import pytesseract
    from PIL import ImageOps

    pix = page.get_pixmap(dpi=dpi, clip=clip, alpha=False, colorspace=fitz.csGRAY)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    if invert:
        img = ImageOps.invert(img)
    img = ImageOps.expand(img, border=20, fill=255)
    data = pytesseract.image_to_data(img, lang=_lang(), config="--oem 1 --psm 7", output_type=pytesseract.Output.DICT)
    words = [
        (data["left"][i], data["left"][i] + data["width"][i], data["height"][i], (w or "").strip())
        for i, w in enumerate(data["text"])
        if (w or "").strip() and float(data["conf"][i]) >= 0
    ]
    if not words:
        return ""
    words.sort()
    h = max(w[2] for w in words) or 1
    text = words[0][3]
    for prev, cur in zip(words, words[1:]):
        gap = cur[0] - prev[1]
        # Tesseract splits Khmer into "words" even where the PDF has no space
        if khmer.is_khmer(text[-1]) and khmer.is_khmer(cur[3][0]) and gap < 0.45 * h:
            text += cur[3]
        else:
            text += " " + cur[3]
    return text


def ocr_words(page: fitz.Page, dpi: int = OCR_DPI, psm: int = 11) -> list[tuple[tuple[float, float, float, float], str]]:
    """Word boxes (PDF points) + text for a whole page. Sparse mode finds scattered slide text too."""
    import pytesseract

    pix = page.get_pixmap(dpi=dpi, alpha=False, colorspace=fitz.csGRAY)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    data = pytesseract.image_to_data(
        img, lang=_lang(), config=f"--oem 1 --psm {psm}", output_type=pytesseract.Output.DICT
    )
    scale = 72.0 / dpi
    out = []
    for i, word in enumerate(data["text"]):
        word = (word or "").strip()
        if not word or float(data["conf"][i]) < 10:
            continue
        x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
        out.append(((x * scale, y * scale, (x + w) * scale, (y + h) * scale), word))
    return out


def estimate_font_size(line_height_pt: float, text: str) -> float:
    """OCR gives the ink height of a line; Khmer ink is taller than the em size."""
    factor = 1.45 if khmer.khmer_ratio(text) > 0.3 else 1.15
    size = line_height_pt / factor
    return max(6.0, min(72.0, round(size * 2) / 2))
