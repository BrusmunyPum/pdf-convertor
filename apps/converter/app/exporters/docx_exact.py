"""PDF -> Word document that keeps every page's exact look.

The page artwork (without text) is a background picture and every text line is an
editable text frame at the exact position, font, size and colour.
"""

from __future__ import annotations

import fitz
from docx import Document
from docx.enum.section import WD_SECTION
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls, qn
from docx.shared import Emu, Pt, RGBColor

from .. import fonts
from ..pipeline import analyze, layout
from .common import Progress
from .docx_common import anchor_picture, is_khmer_capable, polish_runs, set_document_defaults, tiny_paragraph


def convert(pdf_path: str, out_path: str, infos: list[analyze.PageInfo], options: dict,
                  progress: Progress | None = None) -> list[str]:
    warnings: list[str] = []
    dpi = int(options.get("dpi", 200))
    src = fitz.open(pdf_path)
    if src.needs_pass:
        src.authenticate(options.get("password") or "")
    d = Document()
    body = d.element.body
    for p in list(body):
        if p.tag == qn("w:p"):
            body.remove(p)
    scanned = []
    for n, page in enumerate(src):
        info = infos[n]
        if progress:
            progress(n / len(src), f"Page {n + 1}")
        section = d.sections[0] if n == 0 else d.add_section(WD_SECTION.NEW_PAGE)
        W, H = page.rect.width, page.rect.height
        section.page_width, section.page_height = Pt(W), Pt(H)
        for attr in ("left_margin", "right_margin", "top_margin", "bottom_margin", "header_distance", "footer_distance"):
            setattr(section, attr, Emu(0))

        keep_text_in_image = info.needs_ocr
        png = layout.render_background(page, dpi, remove_text=not keep_text_in_image)
        holder = d.add_paragraph()
        tiny_paragraph(holder)
        anchor_picture(holder.add_run(), png, W, H)
        if keep_text_in_image:
            scanned.append(n + 1)
            continue

        for line in layout.extract_lines(page, info.order):
            if abs(line.direction[1]) > 0.01:
                continue  # rotated text stays in the background picture
            x0, y0, x1, y1 = line.bbox
            width = min(W - x0, (x1 - x0) * 1.25 + 24)
            height = max(y1 - y0, 1)
            para = d.add_paragraph()
            ppr = para._p.get_or_add_pPr()
            frame = parse_xml(
                f'<w:framePr {nsdecls("w")} w:w="{int(width * 20)}" w:wrap="around" '
                f'w:hAnchor="page" w:vAnchor="page" w:x="{int(x0 * 20)}" w:y="{int(y0 * 20)}"/>'
            )
            ppr.insert(0, frame)
            pf = para.paragraph_format
            pf.space_before = pf.space_after = Pt(0)
            pf.line_spacing = Pt(height)
            for s in line.spans:
                run = para.add_run(s.text)
                run.font.size = Pt(max(1.0, s.size))
                run.font.bold = s.bold or None
                run.font.italic = s.italic or None
                if s.color != (0, 0, 0):
                    run.font.color.rgb = RGBColor(*s.color)
                run.font.name = s.font
    src.close()
    if scanned:
        warnings.append(f"Scanned pages kept as pictures: {', '.join(map(str, scanned[:20]))}")

    orders = [i.order for i in infos if i.order != "unknown"]
    used = polish_runs(d, orders[0] if orders else "unknown", fix_text=False)
    set_document_defaults(d, fonts.default_khmer_font())
    d.save(out_path)
    if options.get("embedFonts", True):
        fonts.embed_fonts_in_docx(out_path, {f for f in used if is_khmer_capable(f)})
    return warnings
