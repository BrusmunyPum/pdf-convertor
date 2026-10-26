"""Word (DOCX) helpers shared by the flow and exact exporters."""

from __future__ import annotations

import copy
import io
import logging

import fitz
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls, qn
from docx.shared import Pt

from .. import fonts, khmer

log = logging.getLogger(__name__)


# ECMA-376 CT_RPr child order (Word rejects files with children out of order)
RPR_ORDER = [
    "rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike", "dstrike", "outline",
    "shadow", "emboss", "imprint", "noProof", "snapToGrid", "vanish", "webHidden", "color", "spacing",
    "w", "kern", "position", "sz", "szCs", "highlight", "u", "effect", "bdr", "shd", "fitText",
    "vertAlign", "rtl", "cs", "em", "lang", "eastAsianLayout", "specVanish", "oMath",
]


def set_rpr_child(rpr, tag: str, attrs: dict[str, str] | None = None):
    el = rpr.find(qn("w:" + tag))
    if el is None:
        el = rpr.makeelement(qn("w:" + tag), {})
        idx = RPR_ORDER.index(tag)
        inserted = False
        for i, child in enumerate(rpr):
            local = child.tag.split("}")[-1]
            if local in RPR_ORDER and RPR_ORDER.index(local) > idx:
                rpr.insert(i, el)
                inserted = True
                break
        if not inserted:
            rpr.append(el)
    for k, v in (attrs or {}).items():
        el.set(qn("w:" + k), v)
    return el


def _iter_parts(doc):
    yield doc.element.body
    for section in doc.sections:
        for part in (section.header, section.footer, section.first_page_header, section.first_page_footer):
            try:
                if not part.is_linked_to_previous:
                    yield part._element
            except Exception:
                pass


def polish_runs(doc, order: str, fix_text: bool = True) -> set[str]:
    """Fix Khmer text order, map font names and set complex-script properties.
    Returns the set of font families used."""
    used: set[str] = set()
    for root in _iter_parts(doc):
        for r in root.iter(qn("w:r")):
            texts = r.findall(qn("w:t"))
            content = "".join(t.text or "" for t in texts)
            has_khmer = khmer.contains_khmer(content)
            if fix_text and has_khmer:
                for t in texts:
                    if t.text:
                        t.text = khmer.fix_khmer(t.text, order)
            rpr = r.find(qn("w:rPr"))
            if rpr is None:
                if not has_khmer:
                    continue
                rpr = r.makeelement(qn("w:rPr"), {})
                r.insert(0, rpr)
            rfonts = rpr.find(qn("w:rFonts"))
            raw = None
            if rfonts is not None:
                raw = rfonts.get(qn("w:ascii")) or rfonts.get(qn("w:hAnsi")) or rfonts.get(qn("w:cs"))
            family = khmer.clean_font_name(raw)[0] if raw else None
            if has_khmer and (not family or not is_khmer_capable(family)):
                family = family if family and fonts.find_family(family) and is_khmer_capable(family) else fonts.default_khmer_font()
            if family:
                used.add(family)
                attrs = {"ascii": family, "hAnsi": family, "cs": family, "eastAsia": family}
                if has_khmer:
                    attrs["hint"] = "cs"
                set_rpr_child(rpr, "rFonts", attrs)
            if has_khmer:
                if rpr.find(qn("w:b")) is not None:
                    set_rpr_child(rpr, "bCs")
                if rpr.find(qn("w:i")) is not None:
                    set_rpr_child(rpr, "iCs")
                sz = rpr.find(qn("w:sz"))
                if sz is not None:
                    set_rpr_child(rpr, "szCs", {"val": sz.get(qn("w:val"))})
                set_rpr_child(rpr, "lang", {"bidi": "km-KH"})
                # Office has no Khmer spelling dictionary and red-underlines every Khmer word
                set_rpr_child(rpr, "noProof")
    return used


_KHMER_FAMILY_HINTS = ("khmer", "battambang", "siemreap", "moul", "muol", "kantumruy", "hanuman", "bokor",
                       "content", "dangrek", "fasthand", "freehand", "metal", "nokora", "preahvihear",
                       "suwannaphum", "taprom", "angkor", "bayon", "chenla", "koulen", "kdam", "odor",
                       "daunpenh", "moolboran", "limon")


def is_khmer_capable(family: str) -> bool:
    low = family.lower()
    return any(h in low for h in _KHMER_FAMILY_HINTS)


def set_document_defaults(doc, khmer_font: str) -> None:
    """Default complex-script font/language so new typing in Khmer looks right."""
    styles = doc.styles.element
    rpr_default = styles.find(qn("w:docDefaults") + "/" + qn("w:rPrDefault") + "/" + qn("w:rPr"))
    if rpr_default is None:
        return
    set_rpr_child(rpr_default, "rFonts", {"cs": khmer_font})
    set_rpr_child(rpr_default, "lang", {"bidi": "km-KH"})


# ---------------------------------------------------------------------------
# Flow mode
# ---------------------------------------------------------------------------


def anchor_picture(run, png: bytes, width_pt: float, height_pt: float, x_pt: float = 0, y_pt: float = 0) -> None:
    run.add_picture(io.BytesIO(png), width=Pt(width_pt), height=Pt(height_pt))
    inline = run._r.find(".//" + qn("wp:inline"))
    extent = inline.find(qn("wp:extent"))
    doc_pr = inline.find(qn("wp:docPr"))
    graphic = inline.find(qn("a:graphic"))
    anchor = parse_xml(
        f'<wp:anchor {nsdecls("wp", "a", "pic", "r")} distT="0" distB="0" distL="0" distR="0" '
        f'simplePos="0" relativeHeight="0" behindDoc="1" locked="1" layoutInCell="1" allowOverlap="1">'
        f'<wp:simplePos x="0" y="0"/>'
        f'<wp:positionH relativeFrom="page"><wp:posOffset>{int(x_pt * 12700)}</wp:posOffset></wp:positionH>'
        f'<wp:positionV relativeFrom="page"><wp:posOffset>{int(y_pt * 12700)}</wp:posOffset></wp:positionV>'
        f'<wp:extent cx="{extent.get("cx")}" cy="{extent.get("cy")}"/>'
        f'<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>'
        f'<wp:docPr id="{doc_pr.get("id")}" name="Page background"/>'
        f'<wp:cNvGraphicFramePr/></wp:anchor>'
    )
    anchor.append(copy.deepcopy(graphic))
    inline.getparent().replace(inline, anchor)


def tiny_paragraph(para) -> None:
    pf = para.paragraph_format
    pf.space_before = pf.space_after = Pt(0)
    pf.line_spacing = Pt(1)


def font_measurer(family: str):
    """text width (pt) at a font size, using the real font file; None if it is not available."""
    path = fonts.font_file(family)
    if not path:
        return None
    try:
        f = fitz.Font(fontfile=str(path))
    except Exception:
        return None
    return lambda text, size: f.text_length(text, fontsize=size)


def render_clip(page: fitz.Page, rect: fitz.Rect, dpi: int) -> bytes:
    tmp = fitz.open()
    tmp.insert_pdf(page.parent, from_page=page.number, to_page=page.number)
    p = tmp[0]
    for b in p.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            for sp in ln["spans"]:
                if sp["text"].strip():
                    p.add_redact_annot(fitz.Rect(sp["bbox"]), fill=False)
    kwargs = {"images": fitz.PDF_REDACT_IMAGE_NONE}
    if hasattr(fitz, "PDF_REDACT_LINE_ART_NONE"):
        kwargs["graphics"] = fitz.PDF_REDACT_LINE_ART_NONE
    p.apply_redactions(**kwargs)
    png = p.get_pixmap(dpi=dpi, clip=rect & p.rect, alpha=True).tobytes("png")
    tmp.close()
    return png
