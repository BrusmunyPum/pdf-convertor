"""Fonts: the font library, DOCX font embedding and Khmer text-layer repair (glyphmap)."""

from .embed import embed_fonts_in_docx
from .library import FontFamily, default_khmer_font, find_family, font_file, font_library, norm

__all__ = [
    "FontFamily",
    "default_khmer_font",
    "embed_fonts_in_docx",
    "find_family",
    "font_file",
    "font_library",
    "norm",
]
