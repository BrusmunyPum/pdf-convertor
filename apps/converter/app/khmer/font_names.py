"""PDF font names -> real family names, e.g. 'BCDEEE+KhmerOSBattambang-Bold' -> 'Khmer OS Battambang'."""

from __future__ import annotations

import re


KNOWN_FONTS = {
    "khmeros": "Khmer OS",
    "khmerosbattambang": "Khmer OS Battambang",
    "khmerossiemreap": "Khmer OS Siemreap",
    "khmerosmuol": "Khmer OS Muol",
    "khmerosmuollight": "Khmer OS Muol Light",
    "khmerosmuolpali": "Khmer OS Muol Pali",
    "khmeroscontent": "Khmer OS Content",
    "khmerosbokor": "Khmer OS Bokor",
    "khmerosfasthand": "Khmer OS Fasthand",
    "khmerosfreehand": "Khmer OS Freehand",
    "khmerosmetalchrieng": "Khmer OS Metal Chrieng",
    "khmerossys": "Khmer OS System",
    "khmerossystem": "Khmer OS System",
    "khmerosnew": "Khmer OS New",
    "khmerui": "Khmer UI",
    "daunpenh": "DaunPenh",
    "moolboran": "MoolBoran",
    "khmermef1": "Khmer MEF1",
    "khmermef2": "Khmer MEF2",
    "kantumruy": "Kantumruy",
    "kantumruypro": "Kantumruy Pro",
    "notosanskhmer": "Noto Sans Khmer",
    "notosanskhmerui": "Noto Sans Khmer UI",
    "notoserifkhmer": "Noto Serif Khmer",
    "kdamthmor": "Kdam Thmor",
    "kdamthmorpro": "Kdam Thmor Pro",
    "odormeanchey": "Odor Mean Chey",
    "nokora": "Nokora",
    "battambang": "Battambang",
    "siemreap": "Siemreap",
    "moul": "Moul",
    "moulpali": "Moulpali",
    "koulen": "Koulen",
    "hanuman": "Hanuman",
    "bokor": "Bokor",
    "content": "Content",
    "dangrek": "Dangrek",
    "fasthand": "Fasthand",
    "freehand": "Freehand",
    "metal": "Metal",
    "preahvihear": "Preahvihear",
    "suwannaphum": "Suwannaphum",
    "taprom": "Taprom",
    "angkor": "Angkor",
    "bayon": "Bayon",
    "chenla": "Chenla",
    "khmer": "Khmer",
    "arial": "Arial",
    "arialmt": "Arial",
    "arialnarrow": "Arial Narrow",
    "helvetica": "Arial",
    "helveticaneue": "Arial",
    "times": "Times New Roman",
    "timesroman": "Times New Roman",
    "timesnewroman": "Times New Roman",
    "timesnewromanpsmt": "Times New Roman",
    "calibri": "Calibri",
    "calibrilight": "Calibri Light",
    "cambria": "Cambria",
    "cambriamath": "Cambria Math",
    "couriernew": "Courier New",
    "couriernewpsmt": "Courier New",
    "courier": "Courier New",
    "georgia": "Georgia",
    "verdana": "Verdana",
    "tahoma": "Tahoma",
    "segoeui": "Segoe UI",
    "symbol": "Symbol",
    "symbolmt": "Symbol",
    "wingdings": "Wingdings",
    "wingdingsregular": "Wingdings",
    "wingdings2": "Wingdings 2",
    "wingdings3": "Wingdings 3",
    "webdings": "Webdings",
    "dejavusans": "DejaVu Sans",
    "liberationsans": "Liberation Sans",
    "liberationserif": "Liberation Serif",
}


LEGACY_FONT_RE = re.compile(r"limon|^abc[\s_-]|^abc(text|khmer)|baphnom|khmerunicode", re.I)


_STYLE_RE = re.compile(
    r"[,\-_ ]?(bold|semibold|demibold|black|heavy|light|thin|medium|italic|oblique|regular|roman|book|normal|"
    r"boldmt|italicmt|bolditalicmt|mt|psmt|ps)+$",
    re.I,
)


def clean_font_name(raw: str) -> tuple[str, bool, bool]:
    """'ABCDEF+KhmerOSBattambang-Bold' -> ('Khmer OS Battambang', True, False)."""
    name = re.sub(r"^[A-Z]{6}\+", "", raw or "").strip()
    lower = name.lower()
    bold = bool(re.search(r"bold|black|heavy|semibold|demi", lower))
    italic = bool(re.search(r"italic|oblique", lower))
    base = name
    for _ in range(4):
        new = _STYLE_RE.sub("", base)
        if new == base or not new:
            break
        base = new
    # try with the style words kept first ("Khmer OS Muol Light" is a family name)
    full_key = re.sub(r"[^a-z0-9]", "", lower)
    for k in (full_key, full_key.replace("regular", ""), re.sub(r"[^a-z0-9]", "", base.lower())):
        if k in KNOWN_FONTS:
            return KNOWN_FONTS[k], bold, italic
    if not base:
        return "Khmer OS Battambang", bold, italic
    # CamelCase -> words: "SomeFontName" -> "Some Font Name"
    pretty = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", base).replace("_", " ").strip()
    return pretty, bold, italic


def is_legacy_font(raw: str) -> bool:
    name = re.sub(r"^[A-Z]{6}\+", "", raw or "")
    return bool(LEGACY_FONT_RE.search(name))
