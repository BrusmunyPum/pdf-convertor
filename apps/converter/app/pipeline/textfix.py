"""One place that decides the final text of every span, for every output format.

* Khmer glyph order is repaired (visual -> logical Unicode).
* Spans drawn with a Khmer font whose text layer could not be repaired from the
  font file are re-read with OCR, line by line, from a clean render of the page
  with pictures removed.
"""

from __future__ import annotations

import logging
import re
import threading

import fitz

from .. import khmer
from . import ocr


log = logging.getLogger(__name__)


_current = threading.local()


def _norm_font(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", re.sub(r"^[A-Z]{6}\+", "", name or "").lower())


class TextFixer:
    def __init__(self, pdf_path: str, orders: dict[int, str], unreliable_fonts: set[str], use_ocr: bool):
        self.pdf_path = pdf_path
        self.orders = orders
        self.unreliable = {_norm_font(f) for f in unreliable_fonts}
        self.use_ocr = use_ocr and bool(self.unreliable) and ocr.available()
        self._doc: fitz.Document | None = None
        self._clean: fitz.Document | None = None
        self._cleaned: set[int] = set()
        self._cache: dict = {}
        self.ocr_spans = 0

    # -- public -----------------------------------------------------------

    def needs_ocr(self, font: str, text: str) -> bool:
        return self.use_ocr and _norm_font(font) in self.unreliable and khmer.contains_khmer(text)

    def fix(self, pno: int, text: str, font: str, bbox, color: int = 0) -> str:
        fixed = khmer.fix_khmer(text, self.orders.get(pno, "unknown"))
        if not self.needs_ocr(font, fixed):
            return fixed
        read = self._ocr_span(pno, fitz.Rect(bbox), color)
        if not read:
            return fixed
        core = len(fixed.strip()) or 1
        if not 0.4 <= len(read) / core <= 2.2:
            return fixed
        self.ocr_spans += 1
        # keep the span's own leading/trailing spaces so words stay separated
        lead = fixed[: len(fixed) - len(fixed.lstrip())]
        trail = fixed[len(fixed.rstrip()):]
        return lead + read + trail

    def close(self) -> None:
        for d in (self._doc, self._clean):
            if d is not None:
                d.close()
        self._doc = self._clean = None

    # -- internals --------------------------------------------------------

    def _text_only_page(self, pno: int) -> fitz.Page:
        """The page with pictures and shapes removed, so OCR sees only the letters."""
        if self._clean is None:
            self._clean = fitz.open(self.pdf_path)
        page = self._clean[pno]
        if pno not in self._cleaned:
            self._cleaned.add(pno)
            try:
                page.add_redact_annot(page.rect, fill=False)
                page.apply_redactions(
                    images=fitz.PDF_REDACT_IMAGE_REMOVE,
                    graphics=getattr(fitz, "PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED", 2),
                    text=getattr(fitz, "PDF_REDACT_TEXT_NONE", 1),
                )
            except Exception:
                log.warning("could not strip page %s for OCR", pno + 1)
        return page

    def _ocr_span(self, pno: int, rect: fitz.Rect, color: int) -> str:
        key = (pno, tuple(round(v, 1) for v in rect))
        if key in self._cache:
            return self._cache[key]
        r, g, b = (color >> 16) & 255, (color >> 8) & 255, color & 255
        light_text = (0.299 * r + 0.587 * g + 0.114 * b) > 160
        if light_text:  # white text needs its dark background, keep the original render
            if self._doc is None:
                self._doc = fitz.open(self.pdf_path)
            page = self._doc[pno]
        else:
            page = self._text_only_page(pno)
        h = max(rect.height, 1)
        pad = 0.15 * h
        clip = fitz.Rect(rect.x0 - pad, rect.y0 - pad, rect.x1 + pad, rect.y1 + pad) & page.rect
        # aim for ~70 px line height: what Tesseract reads best
        dpi = int(min(600, max(200, 72 * 70 / h)))
        try:
            text = ocr.ocr_line(page, clip, dpi, invert=light_text)
        except Exception:
            log.exception("line OCR failed on page %s", pno + 1)
            text = ""
        text = text.strip(" |!_~`'\"")
        self._cache[key] = text
        return text


def activate(fixer: TextFixer | None) -> None:
    _current.fixer = fixer


def current() -> TextFixer | None:
    return getattr(_current, "fixer", None)


# ---------------------------------------------------------------------------
# pdf2docx hook: fix text right where pdf2docx reads it, before layout parsing
# ---------------------------------------------------------------------------
