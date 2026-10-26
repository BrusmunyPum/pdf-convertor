"""Symbol fonts (Wingdings, Symbol...) -> real Unicode characters.

In Word/PowerPoint output the symbol font is kept, so the original character code
shows the same bullet. Plain-text outputs (TXT, CSV, XLSX) have no font, so those
codes are turned into the Unicode symbol they look like.
"""

from __future__ import annotations

import re


# keyed by the low byte (Word stores symbol characters as U+F0xx or plain 0xxx)
WINGDINGS = {
    0x21: "✏", 0x22: "✂", 0x23: "✁", 0x28: "☎", 0x2A: "✉", 0x36: "⌛", 0x37: "⌨", 0x3E: "✇", 0x3F: "✍",
    0x41: "✌", 0x42: "👌", 0x43: "👍", 0x44: "👎", 0x45: "☜", 0x46: "☞", 0x47: "☝", 0x48: "☟", 0x4A: "☺",
    0x4B: "😐", 0x4C: "☹", 0x4E: "☠", 0x51: "✈", 0x52: "☼", 0x54: "❄", 0x56: "✞", 0x58: "✠", 0x59: "✡",
    0x5A: "☪", 0x5B: "☯", 0x5C: "ॐ", 0x5D: "☸", 0x6C: "●", 0x6D: "❍", 0x6E: "■", 0x6F: "□", 0x70: "◻",
    0x71: "❑", 0x72: "❒", 0x73: "⬧", 0x74: "⧫", 0x75: "◆", 0x76: "❖", 0x77: "⬥", 0x78: "⌧", 0x79: "⍓",
    0x7A: "⌘", 0x7B: "❀", 0x7C: "✿", 0x7D: "❝", 0x7E: "❞", 0x9F: "•", 0xA1: "○", 0xA2: "⭕", 0xA4: "◉",
    0xA6: "◌", 0xA7: "▪", 0xA8: "◻", 0xAA: "✦", 0xAB: "★", 0xAC: "✶", 0xAD: "✴", 0xAE: "✹", 0xAF: "✵",
    0xD5: "⌫", 0xD6: "⌦", 0xD8: "➢", 0xDF: "←", 0xE0: "→", 0xE1: "↑", 0xE2: "↓", 0xE8: "➔", 0xEF: "⇦",
    0xF0: "⇨", 0xF1: "⇧", 0xF2: "⇩", 0xFB: "✗", 0xFC: "✓", 0xFD: "☒", 0xFE: "☑",
}


WINGDINGS2 = {0x50: "✓", 0x4F: "✗", 0x52: "☑", 0x53: "☒", 0x97: "•", 0x98: "▪", 0xA1: "●", 0xA2: "◆", 0xF8: "✱"}


WINGDINGS3 = {0x70: "▲", 0x71: "▼", 0x72: "△", 0x73: "▽", 0x74: "◀", 0x75: "▶", 0x76: "◁", 0x77: "▷",
              0x7D: "▶", 0x7E: "◀", 0xA3: "◄", 0xA4: "►", 0xB4: "►", 0xB3: "◄", 0xC6: "⮜", 0xC7: "⮞"}


SYMBOL = {0xB7: "•", 0xA7: "♣", 0xA8: "♦", 0xA9: "♥", 0xAA: "♠", 0xAE: "→", 0xAC: "←", 0xAD: "↑", 0xAF: "↓",
          0xB0: "°", 0xB1: "±", 0xB4: "×", 0xB8: "÷", 0xA3: "≤", 0xB3: "≥", 0xB9: "≠", 0xBB: "≈", 0xD6: "√",
          0xA5: "∞", 0xE5: "∑", 0xD5: "∏", 0x70: "π", 0x61: "α", 0x62: "β", 0x67: "γ", 0x64: "δ", 0x6D: "μ",
          0x57: "Ω", 0x44: "Δ", 0x53: "Σ"}


TABLES = [
    (re.compile(r"wingdings\s*-?\s*3"), WINGDINGS3),
    (re.compile(r"wingdings\s*-?\s*2"), WINGDINGS2),
    (re.compile(r"wingdings"), WINGDINGS),
    (re.compile(r"^symbol"), SYMBOL),
]


def table_for(font: str) -> dict[int, str] | None:
    low = re.sub(r"^[a-z]{6}\+", "", (font or "").lower())
    for pattern, table in TABLES:
        if pattern.search(low):
            return table
    return None


def to_unicode(text: str, font: str) -> str:
    """Translate a span drawn in a symbol font; other text is returned unchanged."""
    table = table_for(font)
    if table is None:
        # stray Private-Use codes from any font have no meaning in plain text
        return "".join("•" if "" <= ch <= "" else ch for ch in text)
    out = []
    for ch in text:
        code = ord(ch)
        low = code - 0xF000 if 0xF000 <= code <= 0xF0FF else code
        out.append(table.get(low, "•" if 0xF000 <= code <= 0xF0FF else ch))
    return "".join(out)
