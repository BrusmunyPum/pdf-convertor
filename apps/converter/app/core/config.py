"""All converter settings, read once from environment variables."""

from __future__ import annotations

import os
from pathlib import Path


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


# where the API and the converter share uploaded PDFs and results
DATA_DIR = Path(os.getenv("DATA_DIR", "/data")).resolve()

# fonts: bundled with the image, mounted by the admin (./fonts), and system fonts
FONTS_DIR = os.getenv("FONTS_DIR", "/app/fonts")
EXTRA_FONTS_DIR = os.getenv("EXTRA_FONTS_DIR", "/fonts-extra")
SYSTEM_FONT_DIRS = ["/usr/share/fonts"] + ([r"C:\Windows\Fonts"] if os.name == "nt" else [])
DEFAULT_KHMER_FONT = os.getenv("DEFAULT_KHMER_FONT", "Khmer OS Battambang")
MAX_EMBED_BYTES = _int("MAX_EMBED_FONT_MB", 12) * 1024 * 1024

# glyph-shape index of every Khmer font (built once, ~0.3 s per font)
FONT_INDEX_CACHE = Path(os.getenv("FONT_INDEX_CACHE", "/tmp/khmer-font-index"))

# OCR
OCR_LANG = os.getenv("OCR_LANG", "khm+eng")
OCR_DPI = _int("OCR_DPI", 300)

FORMATS = ("docx", "pptx", "xlsx", "csv", "txt", "png", "jpg")
