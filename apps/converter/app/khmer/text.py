"""Khmer Unicode helpers.

PDF text extraction often returns Khmer in *visual* glyph order instead of the
logical Unicode order Word / PowerPoint expect: pre-base vowels and the left-hand
subscript ro come out *before* their consonant. This module detects and repairs it.
"""

from __future__ import annotations

import re
import unicodedata


COENG = "\u17D2"


RO = "\u179A"


PRE_BASE = {"\u17C1", "\u17C2", "\u17C3"}  # េ ែ ៃ


REGISTER_SHIFTERS = {"\u17C9", "\u17CA"}  # ៉ ៊


ROBAT = "\u17CC"


NIKAHIT = "\u17C6"


# When a split vowel's left part is extracted as េ and its right part separately
SPLIT_VOWEL_MERGE = {
    "\u17B6": "\u17C4",  # េ + ា  -> ោ
    "\u17C5": "\u17C5",  # េ + ៅ -> ៅ
    "\u17B8": "\u17BE",  # េ + ី  -> ើ
    "\u17BE": "\u17BE",
    "\u17BF": "\u17BF",  # ឿ
    "\u17C0": "\u17C0",  # ៀ
    "\u17C4": "\u17C4",
}


def is_consonant(ch: str) -> bool:
    return "\u1780" <= ch <= "\u17A2"


def is_indep_vowel(ch: str) -> bool:
    return "\u17A3" <= ch <= "\u17B3"


def is_dep_vowel(ch: str) -> bool:
    return "\u17B6" <= ch <= "\u17C5"


def is_sign(ch: str) -> bool:
    return "\u17C6" <= ch <= "\u17D1" or ch == "\u17DD"


def is_khmer(ch: str) -> bool:
    return "\u1780" <= ch <= "\u17FF" or "\u19E0" <= ch <= "\u19FF"


def is_base(ch: str) -> bool:
    return is_consonant(ch) or is_indep_vowel(ch)


def khmer_ratio(text: str) -> float:
    chars = [c for c in text if not c.isspace()]
    if not chars:
        return 0.0
    return sum(1 for c in chars if is_khmer(c)) / len(chars)


def contains_khmer(text: str) -> bool:
    return any(is_khmer(c) for c in text)


def _can_carry_vowel(prev: str) -> bool:
    """True if a dependent vowel may legally follow `prev` in logical order."""
    return is_base(prev) or prev in REGISTER_SHIFTERS or prev == ROBAT


def detect_order(text: str) -> str:
    """Return 'visual', 'logical' or 'unknown' for a chunk of Khmer text."""
    visual = logical = 0
    n = len(text)
    for i, ch in enumerate(text):
        if ch in PRE_BASE:
            prev = text[i - 1] if i > 0 else ""
            nxt = text[i + 1] if i + 1 < n else ""
            prev_ok = bool(prev) and (_can_carry_vowel(prev) or (i >= 2 and text[i - 2] == COENG))
            if not prev_ok:
                visual += 1
            elif not (is_consonant(nxt) or nxt == COENG):
                logical += 1
        elif ch == COENG and i + 1 < n and text[i + 1] == RO:
            prev = text[i - 1] if i > 0 else ""
            if not prev or not (is_base(prev) or (i >= 2 and text[i - 2] == COENG)):
                visual += 1
    if visual and not logical:
        return "visual"
    if logical and not visual:
        return "logical"
    if visual or logical:
        return "visual" if visual > logical * 2 else "logical"
    return "unknown"


def _take_cluster(text: str, i: int) -> tuple[str, str, int]:
    """Read a consonant cluster starting at i.

    Returns (cluster_without_coeng_ro, coeng_ro_or_empty, next_index)."""
    n = len(text)
    if i >= n or not is_base(text[i]):
        return "", "", i
    out = [text[i]]
    ro = ""
    j = i + 1
    while j < n:
        ch = text[j]
        if ch == COENG and j + 1 < n and is_consonant(text[j + 1]):
            if text[j + 1] == RO:
                ro = COENG + RO
            else:
                out.append(ch + text[j + 1])
            j += 2
        elif ch in REGISTER_SHIFTERS or ch == ROBAT:
            out.append(ch)
            j += 1
        else:
            break
    return "".join(out), ro, j


def _reorder_visual(text: str, only_invalid: bool) -> str:
    out: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        starts_prebase = ch in PRE_BASE or (ch == COENG and i + 1 < n and text[i + 1] == RO)
        if starts_prebase:
            prev = out[-1][-1] if out and out[-1] else ""
            prev_valid = bool(prev) and (
                _can_carry_vowel(prev) or (len(out) and len(out[-1]) >= 2 and out[-1][-2] == COENG)
            )
            if only_invalid and prev_valid:
                out.append(ch)
                i += 1
                continue
            # collect the pre-base parts (vowel and/or coeng ro, any order)
            vowel = ""
            ro = ""
            j = i
            while j < n:
                if text[j] in PRE_BASE and not vowel:
                    vowel = text[j]
                    j += 1
                elif text[j] == COENG and j + 1 < n and text[j + 1] == RO and not ro:
                    ro = COENG + RO
                    j += 2
                else:
                    break
            cluster, ro2, k = _take_cluster(text, j)
            if not cluster:
                out.append(text[i:j])
                i = j
                continue
            ro = ro or ro2
            seg = cluster + ro
            if vowel:
                nxt = text[k] if k < n else ""
                if vowel == "\u17C1" and nxt in SPLIT_VOWEL_MERGE:
                    seg += SPLIT_VOWEL_MERGE[nxt]
                    k += 1
                else:
                    seg += vowel
            out.append(seg)
            i = k
            continue
        out.append(ch)
        i += 1
    return "".join(out)


_SWAP_RULES = [
    # shaping engines insert a dotted circle (◌) for a vowel without a consonant
    (re.compile("េ◌([ើឿៀោៅ])"), "\\1"),
    (re.compile("◌(?=[ា-៓])"), ""),
    # nikahit typed before u/uu: ំុ -> ុំ
    (re.compile("\u17C6([\u17BB\u17BC])"), "\\1\u17C6"),
    # register shifter after a vowel -> before it
    (re.compile("([\u17B6-\u17C5])([\u17C9\u17CA])"), "\\2\\1"),
    # subscript after a dependent vowel -> before it (coeng can never follow a vowel)
    (re.compile("([\u17B6-\u17C5])(\u17D2[\u1780-\u17A2])"), "\\2\\1"),
    # duplicated coeng
    (re.compile("\u17D2{2,}"), "\u17D2"),
]


def fix_khmer(text: str, order: str | None = None) -> str:
    """Repair Khmer extracted from PDFs. Safe to call on already-correct text."""
    if not text or not contains_khmer(text):
        return text
    own = detect_order(text)
    if order is None or order == "unknown" or own == "logical":
        # never reorder text that already proves to be in logical order
        order = own
    if order == "visual":
        text = _reorder_visual(text, only_invalid=False)
    else:
        text = _reorder_visual(text, only_invalid=True)
    for pattern, repl in _SWAP_RULES:
        text = pattern.sub(repl, text)
    return unicodedata.normalize("NFC", text)


def invalid_khmer_ratio(text: str) -> float:
    """Share of dependent vowels/signs that sit where Khmer grammar forbids them."""
    total = bad = 0
    prev = ""
    for ch in text:
        if is_dep_vowel(ch) or ch == COENG:
            total += 1
            if not prev or not (is_khmer(prev)):
                bad += 1
        prev = ch
    return bad / total if total else 0.0


def join_khmer_lines(a: str, b: str) -> str:
    """Join two text lines; Khmer has no spaces between words, so don't add one."""
    if not a.strip():
        return b.strip()
    if not b.strip():
        return a.rstrip()
    if a[-1].isspace() or b[0].isspace():
        return a.rstrip() + " " + b.lstrip()
    if is_khmer(a[-1]) and is_khmer(b[0]):
        return a + b
    return a + " " + b


# ---------------------------------------------------------------------------
# Font names
# ---------------------------------------------------------------------------
