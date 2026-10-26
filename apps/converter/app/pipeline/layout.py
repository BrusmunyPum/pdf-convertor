"""Text lines with position, font, size and colour, plus page artwork without text.
Shared by the PPTX, exact-DOCX and data exporters."""

from __future__ import annotations

from dataclasses import dataclass

import fitz

from .. import khmer
from .analyze import TEXT_FLAGS


@dataclass
class Span:
    text: str
    font: str
    size: float
    bold: bool
    italic: bool
    color: tuple[int, int, int]
    bbox: tuple[float, float, float, float]
    origin: tuple[float, float]


@dataclass
class Line:
    bbox: tuple[float, float, float, float]
    spans: list[Span]
    direction: tuple[float, float] = (1.0, 0.0)
    block: int = 0

    @property
    def text(self) -> str:
        return "".join(s.text for s in self.spans)


def _hidden_rects(page: fitz.Page) -> list[fitz.Rect]:
    try:
        traces = page.get_texttrace()
    except Exception:
        return []
    return [fitz.Rect(t["bbox"]) for t in traces if t.get("type") == 3 or t.get("opacity", 1) == 0]


def _int_to_rgb(c: int) -> tuple[int, int, int]:
    return ((c >> 16) & 255, (c >> 8) & 255, c & 255)


def extract_lines(page: fitz.Page, order: str = "unknown") -> list[Line]:
    from .textfix import current

    fixer = current()
    hidden = _hidden_rects(page)
    data = page.get_text("dict", flags=TEXT_FLAGS)
    lines: list[Line] = []
    for bno, block in enumerate(data["blocks"]):
        if block.get("type") != 0:
            continue
        for ln in block["lines"]:
            spans: list[Span] = []
            for s in ln["spans"]:
                raw = s["text"]
                if not raw.strip():
                    if spans and raw:
                        spans[-1].text += raw
                    continue
                r = fitz.Rect(s["bbox"])
                if hidden and any(abs(r & h) > 0.6 * abs(r) for h in hidden if abs(r)):
                    continue
                family, b, i = khmer.clean_font_name(s["font"])
                flags = s.get("flags", 0)
                text = fixer.fix(page.number, raw, s["font"], s["bbox"], s.get("color", 0)) if fixer else khmer.fix_khmer(raw, order)
                spans.append(
                    Span(
                        text=text,
                        font=family,
                        size=round(s["size"], 2),
                        bold=b or bool(flags & 16),
                        italic=i or bool(flags & 2),
                        color=_int_to_rgb(s.get("color", 0)),
                        bbox=tuple(s["bbox"]),
                        origin=tuple(s["origin"]),
                    )
                )
            if spans:
                x0 = min(s.bbox[0] for s in spans)
                y0 = min(s.bbox[1] for s in spans)
                x1 = max(s.bbox[2] for s in spans)
                y1 = max(s.bbox[3] for s in spans)
                lines.append(Line((x0, y0, x1, y1), spans, tuple(ln.get("dir", (1, 0))), bno))
    return lines


def render_background(page: fitz.Page, dpi: int, remove_text: bool = True) -> bytes:
    """Render a page to PNG. With remove_text, all text is erased first so the
    image keeps only pictures, shapes, lines and colours (text is re-added as
    editable text on top)."""
    if not remove_text:
        return page.get_pixmap(dpi=dpi, alpha=False).tobytes("png")
    tmp = fitz.open()
    tmp.insert_pdf(page.parent, from_page=page.number, to_page=page.number)
    p = tmp[0]
    data = p.get_text("dict", flags=TEXT_FLAGS)
    count = 0
    for block in data["blocks"]:
        if block.get("type") != 0:
            continue
        for ln in block["lines"]:
            for s in ln["spans"]:
                if s["text"].strip():
                    p.add_redact_annot(fitz.Rect(s["bbox"]), fill=False)
                    count += 1
    if count:
        kwargs = {"images": fitz.PDF_REDACT_IMAGE_NONE}
        if hasattr(fitz, "PDF_REDACT_LINE_ART_NONE"):
            kwargs["graphics"] = fitz.PDF_REDACT_LINE_ART_NONE
        if hasattr(fitz, "PDF_REDACT_TEXT_REMOVE"):
            kwargs["text"] = fitz.PDF_REDACT_TEXT_REMOVE
        p.apply_redactions(**kwargs)
    png = p.get_pixmap(dpi=dpi, alpha=False).tobytes("png")
    tmp.close()
    return png
