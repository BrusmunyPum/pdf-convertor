"""Fixes applied to pdf2docx while it runs (a dependency we do not fork):

* text is repaired right where pdf2docx reads it (Khmer order, OCR for unrepairable fonts);
* Khmer paragraphs get the exact PDF line pitch instead of 'multiple of single';
* tab stops are compared with a tolerance (a rounding bug pushed centred lines left).
"""

from __future__ import annotations

from .. import khmer
from ..pipeline.textfix import current


_patched = False


def _respread(chars: list[dict], text: str, bbox) -> list[dict]:
    if not chars:
        return chars
    x0, _, x1, _ = bbox
    n = max(len(text), 1)
    w = (x1 - x0) / n
    proto = chars[0]
    oy = proto["origin"][1]
    cy0, cy1 = proto["bbox"][1], proto["bbox"][3]
    out = []
    for i, ch in enumerate(text):
        item = dict(proto)
        item["c"] = ch
        item["origin"] = (x0 + i * w, oy)
        item["bbox"] = (x0 + i * w, cy0, x0 + (i + 1) * w, cy1)
        out.append(item)
    return out


def _patch_text() -> None:
    global _patched
    if _patched:
        return
    from pdf2docx.page import RawPageFitz

    original = RawPageFitz.RawPageFitz._preprocess_text

    def _preprocess_text(self, **settings):
        blocks = original(self, **settings)
        fixer = current()
        if fixer is None:
            return blocks
        pno = self.page_engine.number
        for block in blocks:
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    chars = span.get("chars") or []
                    text = "".join(c.get("c", "") for c in chars)
                    if not text.strip():
                        continue
                    new = fixer.fix(pno, text, span.get("font", ""), span["bbox"], span.get("color", 0))
                    if new != text:
                        span["chars"] = _respread(chars, new, span["bbox"])
        return blocks

    RawPageFitz.RawPageFitz._preprocess_text = _preprocess_text
    _patched = True


def _patch_line_spacing() -> None:
    """pdf2docx writes "multiple of single" line spacing, but Word's single line for Khmer fonts
    is much taller than the PDF's line pitch, so pages drift down. Use the exact PDF pitch."""
    from pdf2docx.layout import Blocks as blocks_mod

    if getattr(blocks_mod.Blocks, "_khmer_spacing", False):
        return
    original = blocks_mod.Blocks._parse_line_spacing

    def _parse_line_spacing(self):
        original(self)
        for block in self._instances:
            if block.is_text_block and block.line_space_type != 0 and khmer.contains_khmer(block.text):
                block.line_space_type = 0
                block.parse_exact_line_spacing()

    blocks_mod.Blocks._parse_line_spacing = _parse_line_spacing
    blocks_mod.Blocks._khmer_spacing = True
    _patch_tab_stops()


def _patch_tab_stops() -> None:
    """pdf2docx rounds tab stops to 0.1pt but compares them with unrounded line positions,
    so a line starting at 235.06pt misses the 235.1pt stop: one TAB short, and the text
    (e.g. a centred title) lands far to the left. Same logic, compared with a tolerance."""
    from pdf2docx.common import constants
    from pdf2docx.text import Lines as lines_mod

    def parse_tab_stop(self, line_separate_threshold: float):
        block = self.parent
        idx0, idx1 = (0, 2) if block.is_horizontal_text else (3, 1)
        all_pos = {round(abs(line.bbox[idx0] - block.bbox[idx0]), 1) for line in self._instances}
        tab_stops = sorted(p for p in all_pos if p >= constants.MINOR_DIST)
        block.tab_stops = tab_stops
        if not tab_stops:
            return

        def tab_position(pos):
            pos -= block.bbox[idx0]
            return sum(1 for t in tab_stops if pos >= t - 0.5)

        ref = block.bbox[idx0]
        for i, line in enumerate(self._instances):
            if line.bbox[idx0] - ref > line_separate_threshold:
                line.tab_stop = tab_position(line.bbox[idx0]) - tab_position(ref)
            if line == self._instances[-1]:
                break
            ref = line.bbox[idx1] if line.in_same_row(self._instances[i + 1]) else block.bbox[idx0]

    lines_mod.Lines.parse_tab_stop = parse_tab_stop


def apply() -> None:
    """Install all patches (idempotent)."""
    _patch_text()
    _patch_line_spacing()
