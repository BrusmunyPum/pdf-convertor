"""PDF -> PNG / JPG (one image per page, zipped when there are several)."""

from __future__ import annotations

import os
import zipfile

import fitz

from .common import Progress, open_pdf


def to_images(pdf_path: str, out_dir: str, base: str, fmt: str, options: dict, progress: Progress | None = None) -> str:
    dpi = int(options.get("dpi", 200))
    doc = open_pdf(pdf_path, options)
    ext = "jpg" if fmt in ("jpg", "jpeg") else "png"

    def render(page: fitz.Page) -> bytes:
        pix = page.get_pixmap(dpi=dpi, alpha=False)
        return pix.tobytes("jpg", jpg_quality=92) if ext == "jpg" else pix.tobytes("png")

    if len(doc) == 1:
        path = os.path.join(out_dir, f"{base}.{ext}")
        with open(path, "wb") as f:
            f.write(render(doc[0]))
        doc.close()
        return path
    path = os.path.join(out_dir, f"{base}-{ext}.zip")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_STORED) as z:
        for n, page in enumerate(doc):
            if progress:
                progress(n / len(doc), f"Page {n + 1}")
            z.writestr(f"{base}-page-{n + 1:03d}.{ext}", render(page))
    doc.close()
    return path
