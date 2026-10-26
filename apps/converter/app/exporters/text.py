"""PDF -> plain UTF-8 text (tables as tab-separated rows)."""

from __future__ import annotations

import fitz

from .. import khmer
from ..pipeline import layout, ocr
from .common import Progress, line_text, open_pdf
from .tables import tables_with_rects


def to_txt(pdf_path: str, out_path: str, infos, options: dict, progress: Progress | None = None) -> list[str]:
    use_ocr = options.get("ocr", "auto") != "off" and ocr.available()
    doc = open_pdf(pdf_path, options)
    parts = []
    for n, page in enumerate(doc):
        if progress:
            progress(n / len(doc), f"Page {n + 1}")
        info = infos[n]
        if (info.needs_ocr or options.get("ocr") == "force") and use_ocr:
            text = "\n\n".join(b.text for b in ocr.ocr_page(page))
        else:
            # tables become tab-separated rows; everything else becomes paragraphs
            items: list[tuple[float, float, str]] = []
            table_rects = []
            for g, rect in tables_with_rects(page, info):
                table_rects.append(rect)
                items.append((rect.y0, rect.x0, "\n".join("\t".join(r) for r in g.rows)))
            blocks: dict[int, list[layout.Line]] = {}
            for ln in layout.extract_lines(page, info.order):
                blocks.setdefault(ln.block, []).append(ln)
            for lines in blocks.values():
                r = fitz.Rect(lines[0].bbox)
                for ln in lines[1:]:
                    r |= fitz.Rect(ln.bbox)
                if any(abs(r & t) > 0.5 * abs(r) for t in table_rects if abs(r)):
                    continue
                joined = ""
                for ln in lines:
                    t = line_text(ln)
                    joined = khmer.join_khmer_lines(joined, t)
                items.append((r.y0, r.x0, joined.strip()))
            items.sort(key=lambda i: (round(i[0] / 3), i[1]))
            text = "\n\n".join(t for _, _, t in items if t)
        parts.append(text)
    doc.close()
    with open(out_path, "w", encoding="utf-8-sig", newline="\r\n") as f:
        f.write("\n\n\f".join(parts))
    return []
