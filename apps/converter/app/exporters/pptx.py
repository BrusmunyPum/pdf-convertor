"""PDF -> PowerPoint: one slide per page.

Each slide = the page artwork without text (picture) + every text line as an
editable text box at the exact position, with the same font, size and colour.
"""

from __future__ import annotations

import io
from typing import Callable

import fitz
from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE
from pptx.util import Emu, Pt

from .. import khmer
from ..pipeline import analyze, layout, ocr


EMU_PER_PT = 12700


A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"


def _set_typefaces(run, family: str, is_khmer: bool) -> None:
    run.font.name = family  # a:latin
    rpr = run._r.get_or_add_rPr()
    latin = rpr.find(f"{{{A_NS}}}latin")
    anchor = latin
    for tag in ("ea", "cs"):
        el = rpr.find(f"{{{A_NS}}}{tag}")
        if el is None:
            el = etree.Element(f"{{{A_NS}}}{tag}")
            anchor.addnext(el)
        el.set("typeface", family)
        anchor = el
    if is_khmer:
        rpr.set("lang", "km-KH")
        rpr.set("altLang", "en-US")
        # PowerPoint has no Khmer spelling dictionary and would red-underline every word
        rpr.set("noProof", "1")


def convert(pdf_path: str, out_path: str, infos: list[analyze.PageInfo], options: dict,
            progress: Callable[[float, str], None] | None = None) -> list[str]:
    warnings: list[str] = []
    dpi = int(options.get("dpi", 200))
    use_ocr = options.get("ocr", "auto") != "off" and ocr.available()
    src = fitz.open(pdf_path)
    if src.needs_pass:
        src.authenticate(options.get("password") or "")

    prs = Presentation()
    first = src[0].rect
    slide_w, slide_h = first.width, first.height
    prs.slide_width = Emu(int(slide_w * EMU_PER_PT))
    prs.slide_height = Emu(int(slide_h * EMU_PER_PT))
    blank = prs.slide_layouts[6]

    for n, page in enumerate(src):
        info = infos[n]
        if progress:
            progress(n / len(src), f"Slide {n + 1}")
        # pages with a different size are scaled to fit the slide
        scale = min(slide_w / page.rect.width, slide_h / page.rect.height)
        off_x = (slide_w - page.rect.width * scale) / 2
        off_y = (slide_h - page.rect.height * scale) / 2

        def emu(v: float) -> Emu:
            return Emu(int(v * EMU_PER_PT))

        slide = prs.slides.add_slide(blank)
        keep_text = info.needs_ocr
        png = layout.render_background(page, dpi, remove_text=not keep_text)
        slide.shapes.add_picture(io.BytesIO(png), emu(off_x), emu(off_y),
                                 emu(page.rect.width * scale), emu(page.rect.height * scale))

        if keep_text:
            if use_ocr:
                text = "\n".join(b.text for b in ocr.ocr_page(page))
                slide.notes_slide.notes_text_frame.text = text
            continue

        for line in layout.extract_lines(page, info.order):
            if abs(line.direction[1]) > 0.01:
                continue
            x0, y0, x1, y1 = line.bbox
            w = (x1 - x0) * 1.2 + 12
            h = max(y1 - y0, 4)
            box = slide.shapes.add_textbox(emu(off_x + x0 * scale), emu(off_y + y0 * scale),
                                           emu(w * scale), emu(h * scale))
            tf = box.text_frame
            tf.word_wrap = False
            tf.auto_size = MSO_AUTO_SIZE.NONE
            tf.vertical_anchor = MSO_ANCHOR.TOP
            tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
            para = tf.paragraphs[0]
            for s in line.spans:
                run = para.add_run()
                run.text = s.text
                f = run.font
                f.size = Pt(max(1.0, round(s.size * scale * 2) / 2))
                f.bold = s.bold
                f.italic = s.italic
                f.color.rgb = RGBColor(*s.color)
                _set_typefaces(run, s.font, khmer.contains_khmer(s.text))
    src.close()
    scanned = [i.index + 1 for i in infos if i.needs_ocr]
    if scanned:
        warnings.append(f"Scanned pages kept as pictures (OCR text in speaker notes): "
                        f"{', '.join(map(str, scanned[:20]))}")
    prs.save(out_path)
    return warnings
