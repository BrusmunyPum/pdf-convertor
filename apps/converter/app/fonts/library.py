"""Font library: every font file the converter can use (bundled, extra and system fonts)."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from ..core import config


log = logging.getLogger(__name__)


DEFAULT_KHMER_FONT = config.DEFAULT_KHMER_FONT


FALLBACK_KHMER_FONTS = ["Khmer OS Battambang", "Battambang", "Khmer OS", "Noto Sans Khmer", "Kantumruy Pro"]


def norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


@dataclass
class FontFamily:
    name: str
    files: dict[str, Path] = field(default_factory=dict)  # regular/bold/italic/bolditalic
    embeddable: bool = True


def _font_dirs() -> list[Path]:
    dirs = [config.FONTS_DIR, config.EXTRA_FONTS_DIR, *config.SYSTEM_FONT_DIRS]
    return [Path(d) for d in dirs if d and Path(d).is_dir()]


@lru_cache(maxsize=1)
def font_library() -> dict[str, FontFamily]:
    from fontTools.ttLib import TTFont

    lib: dict[str, FontFamily] = {}
    for d in _font_dirs():
        for path in d.rglob("*"):
            if path.suffix.lower() not in (".ttf", ".otf"):
                continue
            try:
                f = TTFont(str(path), lazy=True, fontNumber=0)
                names = f["name"]
                family = (names.getDebugName(16) or names.getDebugName(1) or "").strip()
                sub = (names.getDebugName(17) or names.getDebugName(2) or "Regular").strip().lower()
                fs_type = f["OS/2"].fsType if "OS/2" in f else 0
                f.close()
            except Exception:  # broken font file
                continue
            if not family:
                continue
            style = "regular"
            if "bold" in sub and ("italic" in sub or "oblique" in sub):
                style = "bolditalic"
            elif "bold" in sub:
                style = "bold"
            elif "italic" in sub or "oblique" in sub:
                style = "italic"
            elif sub not in ("regular", "normal", "book", "roman"):
                # Light/Medium etc. are separate weights; keep only as fallback regular
                style = "other:" + sub
            fam = lib.setdefault(norm(family), FontFamily(name=family))
            if style.startswith("other:"):
                fam.files.setdefault("regular_fallback", path)
            else:
                fam.files.setdefault(style, path)
            # bit 1 (0x0002) = restricted license: must not be embedded
            if fs_type & 0x0002:
                fam.embeddable = False
    log.info("font library: %d families", len(lib))
    return lib


def find_family(name: str) -> FontFamily | None:
    return font_library().get(norm(name))


def default_khmer_font() -> str:
    for cand in [DEFAULT_KHMER_FONT, *FALLBACK_KHMER_FONTS]:
        if find_family(cand):
            return find_family(cand).name  # type: ignore[union-attr]
    return DEFAULT_KHMER_FONT


def font_file(name: str, bold: bool = False, italic: bool = False) -> Path | None:
    fam = find_family(name)
    if not fam:
        return None
    key = ("bold" if bold else "") + ("italic" if italic else "") or "regular"
    return fam.files.get(key) or fam.files.get("regular") or fam.files.get("regular_fallback")


# ---------------------------------------------------------------------------
# DOCX embedding (ECMA-376 obfuscated fonts, *.odttf)
# ---------------------------------------------------------------------------
