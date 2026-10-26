"""Khmer text knowledge: Unicode order repair, font names, symbol fonts."""

from .font_names import KNOWN_FONTS, clean_font_name, is_legacy_font
from .text import (
    COENG,
    RO,
    contains_khmer,
    detect_order,
    fix_khmer,
    invalid_khmer_ratio,
    is_consonant,
    is_dep_vowel,
    is_khmer,
    join_khmer_lines,
    khmer_ratio,
)

__all__ = [
    "COENG",
    "KNOWN_FONTS",
    "RO",
    "clean_font_name",
    "contains_khmer",
    "detect_order",
    "fix_khmer",
    "invalid_khmer_ratio",
    "is_consonant",
    "is_dep_vowel",
    "is_khmer",
    "is_legacy_font",
    "join_khmer_lines",
    "khmer_ratio",
]
