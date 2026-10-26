"""Repair the Unicode text layer of Khmer PDFs.

Microsoft Word / PowerPoint (and many other tools) write a broken /ToUnicode table
for Khmer: glyphs that come from OpenType shaping (subscripts, the pre-base vowel,
coeng ro…) get mapped to the wrong characters, so copy/paste or any converter reads
"សសចក្ដី" instead of "សេចក្ដី".

The glyphs drawn in the PDF are still correct, so we rebuild the mapping from the
font itself:

1. every glyph embedded in the PDF is matched to the same glyph in a full copy of
   the font by its *outline*, so it works even when the PDF was made with another
   version of the font (glyph numbers differ between versions, shapes do not);
2. the full font's cmap gives plain glyphs, and walking its GSUB table tells us
   which character sequence produced every shaped glyph.

A new /ToUnicode CMap is written into a repaired copy of the PDF that every later
step reads.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import os
import pickle
import re
import time
from functools import lru_cache

import fitz
from fontTools.ttLib import TTFont

from .. import khmer
from ..core import config
from . import library as fonts

log = logging.getLogger(__name__)

SUB_HINTS = ("sub", "below", "coeng", "blwf", "conj")

KHMER_FAMILY_HINTS = ("khmer", "battambang", "siemreap", "moul", "muol", "mool", "daunpenh", "kantumruy",
                      "hanuman", "bokor", "content", "dangrek", "fasthand", "freehand", "metal", "nokora",
                      "preahvihear", "suwannaphum", "taprom", "angkor", "bayon", "chenla", "koulen", "kdam",
                      "odor", "mef", "noto", "limon")


def _is_pua(text: str) -> bool:
    return bool(text) and ("" <= text[0] <= "")


def _unwrap(lookup_type: int, st):
    if lookup_type == 7:  # extension
        return st.ExtSubTable.LookupType if hasattr(st.ExtSubTable, "LookupType") else st.ExtensionLookupType, st.ExtSubTable
    return lookup_type, st


def reverse_map(tt: TTFont) -> dict[int, str]:
    """glyph id -> the Unicode text that produces that glyph."""
    order = tt.getGlyphOrder()
    gid = {name: i for i, name in enumerate(order)}
    names: dict[str, str] = {}
    cmap = tt.getBestCmap() or {}
    for cp, gname in sorted(cmap.items()):
        # Khmer fonts give shaped forms Private-Use codes (U+F1xx); those are not text,
        # the real characters are recovered from GSUB below
        if 0xE000 <= cp <= 0xF8FF or 0xF0000 <= cp:
            continue
        if gname not in names or (khmer.is_khmer(chr(cp)) and not khmer.is_khmer(names[gname][:1])):
            names[gname] = chr(cp)

    if "GSUB" in tt:
        lookups = tt["GSUB"].table.LookupList.Lookup if tt["GSUB"].table.LookupList else []
        for _ in range(4):  # repeat: outputs of one lookup feed the next
            changed = False
            for lk in lookups:
                for st in lk.SubTable:
                    ltype, sub = _unwrap(lk.LookupType, st)
                    if ltype == 1:
                        for src, dst in getattr(sub, "mapping", {}).items():
                            if dst not in names and src in names:
                                text = names[src]
                                if any(h in dst.lower() for h in SUB_HINTS) and not text.startswith(khmer.COENG) \
                                        and khmer.is_consonant(text[:1]):
                                    text = khmer.COENG + text
                                names[dst] = text
                                changed = True
                    elif ltype == 2:
                        for src, outs in getattr(sub, "mapping", {}).items():
                            if src in names and outs and outs[0] not in names:
                                names[outs[0]] = names[src]
                                for o in outs[1:]:
                                    names.setdefault(o, "")
                                changed = True
                    elif ltype == 3:
                        for src, alts in getattr(sub, "alternates", {}).items():
                            for a in alts:
                                if a not in names and src in names:
                                    names[a] = names[src]
                                    changed = True
                    elif ltype == 4:
                        for first, ligs in getattr(sub, "ligatures", {}).items():
                            for lig in ligs:
                                if lig.LigGlyph in names:
                                    continue
                                parts = [first, *lig.Component]
                                if all(p in names for p in parts):
                                    names[lig.LigGlyph] = "".join(names[p] for p in parts)
                                    changed = True
            if not changed:
                break
    return {gid[n]: t for n, t in names.items() if n in gid}


def _cmap_stream(mapping: dict[int, str]) -> bytes:
    lines = [
        "/CIDInit /ProcSet findresource begin", "12 dict begin", "begincmap",
        "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
        "/CMapName /Adobe-Identity-UCS def", "/CMapType 2 def",
        "1 begincodespacerange", "<0000> <FFFF>", "endcodespacerange",
    ]
    items = sorted((g, t) for g, t in mapping.items() if t and 0 <= g <= 0xFFFF)
    for i in range(0, len(items), 100):
        chunk = items[i:i + 100]
        lines.append(f"{len(chunk)} beginbfchar")
        for g, t in chunk:
            lines.append(f"<{g:04X}> <{t.encode('utf-16-be').hex().upper()}>")
        lines.append("endbfchar")
    lines += ["endcmap", "CMapName currentdict /CMap defineresource pop", "end", "end"]
    return "\n".join(lines).encode()


def _parse_tounicode(data: bytes) -> dict[int, str]:
    """Minimal ToUnicode CMap parser (bfchar + bfrange)."""
    out: dict[int, str] = {}
    text = data.decode("latin-1", "ignore")

    def u(hexstr: str) -> str:
        try:
            return bytes.fromhex(hexstr).decode("utf-16-be", "ignore")
        except ValueError:
            return ""

    for block in re.findall(r"beginbfchar(.*?)endbfchar", text, re.S):
        for src, dst in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>", block):
            out[int(src, 16)] = u(dst)
    for block in re.findall(r"beginbfrange(.*?)endbfrange", text, re.S):
        for a, b, rest in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(\[[^\]]*\]|<[0-9A-Fa-f]*>)", block):
            lo, hi = int(a, 16), int(b, 16)
            if rest.startswith("["):
                for k, h in enumerate(re.findall(r"<([0-9A-Fa-f]*)>", rest)):
                    out[lo + k] = u(h)
            elif hi - lo < 0x10000:
                base = u(rest.strip("<>"))
                if base:
                    for k in range(hi - lo + 1):
                        out[lo + k] = base[:-1] + chr(ord(base[-1]) + k)
    return out


def _embedded_font(doc: fitz.Document, font_xref: int) -> TTFont | None:
    try:
        _, ext, _, buf = doc.extract_font(font_xref)
        if buf and ext in ("ttf", "otf"):
            return TTFont(io.BytesIO(buf))
    except Exception:
        pass
    return None


def _sig(tt: TTFont, gname: str):
    """Outline fingerprint of one glyph (None for empty glyphs)."""
    try:
        glyf = tt["glyf"]
        g = glyf[gname]
        if g.numberOfContours == 0:
            return None
        coords, ends, _ = g.getCoordinates(glyf)
        if not len(coords):
            return None
        coords.toInt()
        # stable across processes (built-in hash() is randomized per process, and this is cached on disk)
        h = hashlib.blake2b(bytes(coords.array), digest_size=8)
        h.update(repr(tuple(ends)).encode())
        return int.from_bytes(h.digest(), "little")
    except Exception:
        return None


CACHE_DIR = config.FONT_INDEX_CACHE


@lru_cache(maxsize=256)
def _library_index(path: str) -> tuple[dict[int, list[int]], dict[int, str], int]:
    """For a font file: outline fingerprint -> glyph ids, glyph id -> text, glyph count.

    Building this takes ~0.3 s per font, so it is cached on disk as well."""
    st = os.stat(path)
    key = hashlib.sha1(f"{path}|{st.st_size}|{st.st_mtime_ns}|v3".encode()).hexdigest()
    cache_file = CACHE_DIR / f"{key}.pkl"
    try:
        with open(cache_file, "rb") as fh:
            return pickle.load(fh)
    except Exception:
        pass
    tt = TTFont(path, fontNumber=0)
    rev = reverse_map(tt)
    sigs: dict[int, list[int]] = {}
    if "glyf" in tt:
        for i, name in enumerate(tt.getGlyphOrder()):
            sg = _sig(tt, name)
            if sg is not None:
                sigs.setdefault(sg, []).append(i)
    result = (sigs, rev, len(tt.getGlyphOrder()))
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = cache_file.with_suffix(".tmp%d" % os.getpid())
        with open(tmp, "wb") as fh:
            pickle.dump(result, fh, protocol=pickle.HIGHEST_PROTOCOL)
        os.replace(tmp, cache_file)
    except OSError:
        pass
    return result


@lru_cache(maxsize=2048)
def _has_khmer(path: str) -> bool:
    """True if the font file can draw Khmer (checked from its cmap, not its name)."""
    try:
        tt = TTFont(path, lazy=True, fontNumber=0)
        cmap = tt.getBestCmap() or {}
        return 0x1780 in cmap and 0x17D2 in cmap
    except Exception:
        return False


@lru_cache(maxsize=1)
def khmer_font_paths() -> list[str]:
    """Font files that can draw Khmer. Opening ~450 fonts takes seconds, so the answer is
    cached on disk, keyed by every file's size + modification time."""
    all_paths = sorted({str(p) for f in fonts.font_library().values() for p in f.files.values()})
    stamp = hashlib.sha1(
        "|".join(f"{p}:{os.stat(p).st_size}:{os.stat(p).st_mtime_ns}" for p in all_paths).encode()
    ).hexdigest()
    cache_file = CACHE_DIR / f"khmer-paths-{stamp}.json"
    try:
        return json.loads(cache_file.read_text())
    except Exception:
        pass
    paths = [p for p in all_paths if _has_khmer(p)]
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(paths))
    except OSError:
        pass
    return paths


def warm_up() -> None:
    """Index every Khmer font once (run in the background at startup)."""
    started = time.time()
    paths = khmer_font_paths()
    for p in paths:
        try:
            _library_index(p)
        except Exception:
            log.warning("cannot index font %s", p)
    log.info("indexed %d Khmer fonts in %.1fs", len(paths), time.time() - started)


def _candidate_paths(family: str, bold: bool, italic: bool, everything: bool) -> list[str]:
    paths: list[str] = []
    first = fonts.font_file(family, bold, italic)
    if first:
        paths.append(str(first))
    fam = fonts.find_family(family)
    if fam:
        paths += [str(p) for p in fam.files.values() if str(p) not in paths]
    if everything:
        paths += [p for p in khmer_font_paths() if p not in paths]
    return paths


def _resolve(embedded: TTFont | None, original: dict[int, str], family: str, bold: bool, italic: bool):
    """gid -> text for one embedded font, or None when no matching full font is available."""
    if embedded is None or "glyf" not in embedded:
        return None
    order = embedded.getGlyphOrder()
    used = [(gid, _sig(embedded, name)) for gid, name in enumerate(order)]
    used = [(g, s) for g, s in used if s is not None]
    if not used:
        return None

    def score(path: str) -> int:
        sigs, _, _ = _library_index(path)
        return sum(1 for _, s in used if s in sigs)

    paths = _candidate_paths(family, bold, italic, everything=False)
    best = max(paths, key=score, default=None)
    if best is None or score(best) < 0.6 * len(used):
        # the font name may differ (e.g. "Khmer Mool1"): try every Khmer font we have
        paths = _candidate_paths(family, bold, italic, everything=True)
        best = max(paths, key=score, default=None)
    if best is None or score(best) < 0.5 * len(used):
        return None

    sigs, rev, n_lib = _library_index(best)
    others = [p for p in paths if p != best]
    mapping: dict[int, str] = {}
    same_numbering = 0
    for gid, sg in used:
        cands = sigs.get(sg)
        lib_rev = rev
        if not cands:
            for p in others:  # e.g. a glyph that only exists in the bold file
                s2, r2, _ = _library_index(p)
                if sg in s2:
                    cands, lib_rev = s2[sg], r2
                    break
        if not cands:
            continue
        if gid in cands:
            pick = gid
            same_numbering += 1
        else:
            # identical shapes (e.g. subscript ta / da): trust the PDF's own text when it is one of them
            orig = original.get(gid)
            pick = next((c for c in cands if lib_rev.get(c) == orig), cands[0])
        text = lib_rev.get(pick)
        if text is not None:
            mapping[gid] = text
    # empty-outline glyphs (spaces, zero-width marks): only trust numbering when versions match
    if same_numbering > 0.9 * len(used) and len(order) == n_lib:
        for gid in range(len(order)):
            if gid not in mapping and gid in rev:
                mapping[gid] = rev[gid]
    for gid, text in original.items():
        if gid not in mapping and text and not _is_pua(text):
            mapping[gid] = text
    matched = sum(1 for g, s in used if s in sigs or any(s in _library_index(p)[0] for p in others))
    log.info("repaired %s with %s (%d/%d glyphs matched)", family, best, matched, len(used))
    return mapping, matched / len(used)


def repair(doc: fitz.Document) -> tuple[list[str], set[str]]:
    """Rewrite /ToUnicode for Khmer Type0 fonts in-place.

    Returns (repaired family names, PDF font names whose text is still unreliable)."""
    repaired: list[str] = []
    unreliable: set[str] = set()
    seen: set[int] = set()
    for page in doc:
        for xref, ext, ftype, basefont, *_ in page.get_fonts(full=True):
            if xref in seen or ftype != "Type0":
                continue
            seen.add(xref)
            enc = doc.xref_get_key(xref, "Encoding")[1]
            if enc not in ("/Identity-H", "/Identity-V"):
                continue
            desc = doc.xref_get_key(xref, "DescendantFonts")
            cid_xref = None
            if desc[0] == "array":
                ref = desc[1].strip("[] ").split()
                if ref:
                    cid_xref = int(ref[0])
            elif desc[0] == "xref":
                cid_xref = int(desc[1].split()[0])
            if cid_xref:
                gmap = doc.xref_get_key(cid_xref, "CIDToGIDMap")
                if gmap[0] not in ("null", "name"):
                    continue  # custom CID->GID table; leave as is

            tu = doc.xref_get_key(xref, "ToUnicode")
            original: dict[int, str] = {}
            if tu[0] == "xref":
                try:
                    original = _parse_tounicode(doc.xref_stream(int(tu[1].split()[0])) or b"")
                except Exception:
                    original = {}
            family, bold, italic = khmer.clean_font_name(basefont)
            looks_khmer = any(h in family.lower() for h in KHMER_FAMILY_HINTS) or any(
                khmer.contains_khmer(t) for t in original.values()
            )
            if not looks_khmer:
                continue
            pdf_name = re.sub(r"^[A-Z]{6}\+", "", basefont)
            try:
                result = _resolve(_embedded_font(doc, xref), original, family, bold, italic)
            except Exception:
                log.exception("glyph matching failed for %s", basefont)
                result = None
            if not result:
                log.info("cannot repair %s: original font not available", basefont)
                unreliable.add(pdf_name)
                continue
            mapping, ratio = result
            if ratio < 0.97:
                unreliable.add(pdf_name)
            stream = _cmap_stream(mapping)
            if tu[0] == "xref":
                doc.update_stream(int(tu[1].split()[0]), stream)
            else:
                new = doc.get_new_xref()
                doc.update_object(new, "<<>>")
                doc.update_stream(new, stream)
                doc.xref_set_key(xref, "ToUnicode", f"{new} 0 R")
            repaired.append(family)
    return repaired, unreliable


def repair_file(src: str, dst: str, password: str | None = None) -> tuple[list[str], set[str]]:
    doc = fitz.open(src)
    if doc.needs_pass:
        doc.authenticate(password or "")
    fixed, unreliable = repair(doc)
    if fixed:
        doc.save(dst, garbage=0, deflate=True, encryption=fitz.PDF_ENCRYPT_NONE)
    doc.close()
    return fixed, unreliable
