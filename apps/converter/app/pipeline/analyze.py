"""Page classification: normal text, scanned, broken text layer or empty."""

from __future__ import annotations

from dataclasses import dataclass, field

import fitz

from .. import khmer


TEXT_FLAGS = fitz.TEXT_PRESERVE_WHITESPACE | fitz.TEXT_PRESERVE_LIGATURES | fitz.TEXT_MEDIABOX_CLIP


@dataclass
class PageInfo:
    index: int
    kind: str  # text | scanned | garbled | empty
    order: str  # visual | logical | unknown (Khmer glyph order of the text layer)
    khmer_ratio: float
    char_count: int
    reasons: list[str] = field(default_factory=list)
    fonts: list[str] = field(default_factory=list)

    @property
    def needs_ocr(self) -> bool:
        return self.kind in ("scanned", "garbled")


def _image_coverage(page: fitz.Page) -> float:
    area = abs(page.rect)
    if not area:
        return 0.0
    covered = 0.0
    for info in page.get_image_info():
        r = fitz.Rect(info["bbox"]) & page.rect
        covered += abs(r)
    return min(covered / area, 1.0)


def _invisible_text_share(page: fitz.Page) -> float:
    try:
        traces = page.get_texttrace()
    except Exception:
        return 0.0
    total = hidden = 0
    for t in traces:
        n = len(t.get("chars", ()))
        total += n
        if t.get("type") == 3 or t.get("opacity", 1) == 0:
            hidden += n
    return hidden / total if total else 0.0


def analyze_page(page: fitz.Page) -> PageInfo:
    text = page.get_text("text", flags=TEXT_FLAGS)
    chars = [c for c in text if not c.isspace()]
    n = len(chars)
    fonts = sorted({f[3] for f in page.get_fonts(full=False)})
    kh_ratio = khmer.khmer_ratio(text)
    order = khmer.detect_order(text) if kh_ratio > 0.05 else "unknown"
    info = PageInfo(page.number, "text", order, kh_ratio, n, fonts=fonts)

    if n < 12:
        coverage = _image_coverage(page)
        if coverage > 0.25:
            info.kind = "scanned"
            info.reasons.append("image-only page")
        else:
            # text converted to outlines shows up as lots of vector paths
            try:
                paths = len(page.get_drawings())
            except Exception:
                paths = 0
            if paths > 150:
                info.kind = "scanned"
                info.reasons.append("text drawn as vector outlines")
            else:
                info.kind = "empty" if n == 0 else "text"
        return info

    if _invisible_text_share(page) > 0.8 and _image_coverage(page) > 0.5:
        info.kind = "scanned"
        info.reasons.append("scanned page with hidden OCR layer")
        return info

    bad = sum(1 for c in chars if c == "�" or "" <= c <= "" or (ord(c) < 32))
    if bad / n > 0.15:
        info.kind = "garbled"
        info.reasons.append("text layer has no Unicode mapping")
        return info

    if any(khmer.is_legacy_font(f) for f in fonts) and kh_ratio < 0.05:
        info.kind = "garbled"
        info.reasons.append("legacy (non-Unicode) Khmer font such as Limon/ABC")
        return info

    if kh_ratio > 0.2:
        fixed = khmer.fix_khmer(text, order)
        if khmer.invalid_khmer_ratio(fixed) > 0.2:
            info.kind = "garbled"
            info.reasons.append("Khmer text layer is broken")
    return info


def analyze(doc: fitz.Document) -> list[PageInfo]:
    return [analyze_page(p) for p in doc]


# ---------------------------------------------------------------------------
# Layout lines (for PPTX / exact DOCX / text outputs)
# ---------------------------------------------------------------------------
