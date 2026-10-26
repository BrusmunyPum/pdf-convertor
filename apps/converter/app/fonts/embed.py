"""Embed fonts into a DOCX (ECMA-376 obfuscated *.odttf), so the document renders with
the same Khmer font even on a computer where it is not installed."""

from __future__ import annotations

import logging
import os
import uuid
import zipfile
from pathlib import Path

from lxml import etree

from ..core import config
from .library import find_family


log = logging.getLogger(__name__)


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"


FONT_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font"


FONT_TABLE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable"


MAX_EMBED_BYTES = config.MAX_EMBED_BYTES


def _obfuscate(data: bytes, guid: str) -> bytes:
    hexkey = guid.strip("{}").replace("-", "")
    key = bytes.fromhex(hexkey)[::-1]
    head = bytes(b ^ key[i % 16] for i, b in enumerate(data[:32]))
    return head + data[32:]


def embed_fonts_in_docx(docx_path: str, families: set[str]) -> list[str]:
    """Embed the given font families into an existing DOCX. Returns embedded names."""
    targets: list[tuple[str, dict[str, Path]]] = []
    for name in sorted(families):
        fam = find_family(name)
        if not fam or not fam.embeddable:
            continue
        files = {k: v for k, v in fam.files.items() if k in ("regular", "bold", "italic", "bolditalic")}
        if not files and "regular_fallback" in fam.files:
            files = {"regular": fam.files["regular_fallback"]}
        if files:
            targets.append((name, files))
    if not targets:
        return []

    tmp = docx_path + ".tmp"
    embedded: list[str] = []
    with zipfile.ZipFile(docx_path) as zin:
        items = {i.filename: zin.read(i.filename) for i in zin.infolist()}

    ft_name = "word/fontTable.xml"
    ft_rels_name = "word/_rels/fontTable.xml.rels"
    if ft_name in items:
        font_table = etree.fromstring(items[ft_name])
    else:
        font_table = etree.fromstring(
            f'<w:fonts xmlns:w="{W_NS}" xmlns:r="{R_NS}"></w:fonts>'.encode()
        )
        _ensure_doc_rel(items, FONT_TABLE_REL, "fontTable.xml")
        _ensure_override(
            items, "/word/fontTable.xml",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml",
        )
    rels = (
        etree.fromstring(items[ft_rels_name])
        if ft_rels_name in items
        else etree.fromstring(f'<Relationships xmlns="{PKG_REL_NS}"></Relationships>'.encode())
    )

    total = 0
    counter = len([n for n in items if n.startswith("word/fonts/")])
    tag_for = {"regular": "embedRegular", "bold": "embedBold", "italic": "embedItalic", "bolditalic": "embedBoldItalic"}
    for name, files in targets:
        size = sum(p.stat().st_size for p in files.values())
        if total + size > MAX_EMBED_BYTES:
            log.info("skip embedding %s (size budget)", name)
            continue
        font_el = None
        for el in font_table.findall(f"{{{W_NS}}}font"):
            if el.get(f"{{{W_NS}}}name") == name:
                font_el = el
                break
        if font_el is None:
            font_el = etree.SubElement(font_table, f"{{{W_NS}}}font")
            font_el.set(f"{{{W_NS}}}name", name)
            cs = etree.SubElement(font_el, f"{{{W_NS}}}charset")
            cs.set(f"{{{W_NS}}}val", "00")
            pitch = etree.SubElement(font_el, f"{{{W_NS}}}pitch")
            pitch.set(f"{{{W_NS}}}val", "variable")
        for style, path in files.items():
            counter += 1
            guid = "{" + str(uuid.uuid4()).upper() + "}"
            rid = f"rIdFont{counter}"
            target = f"fonts/font{counter}.odttf"
            items["word/" + target] = _obfuscate(path.read_bytes(), guid)
            rel = etree.SubElement(rels, f"{{{PKG_REL_NS}}}Relationship")
            rel.set("Id", rid)
            rel.set("Type", FONT_REL)
            rel.set("Target", target)
            emb = etree.SubElement(font_el, f"{{{W_NS}}}{tag_for[style]}")
            emb.set(f"{{{R_NS}}}id", rid)
            emb.set(f"{{{W_NS}}}fontKey", guid)
        total += size
        embedded.append(name)

    if not embedded:
        return []
    items[ft_name] = etree.tostring(font_table, xml_declaration=True, encoding="UTF-8", standalone=True)
    items[ft_rels_name] = etree.tostring(rels, xml_declaration=True, encoding="UTF-8", standalone=True)
    _ensure_default_ct(items, "odttf", "application/vnd.openxmlformats-officedocument.obfuscatedFont")
    _enable_embed_setting(items)

    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        # [Content_Types].xml must stay first
        order = ["[Content_Types].xml"] + [n for n in items if n != "[Content_Types].xml"]
        for n in order:
            zout.writestr(n, items[n])
    os.replace(tmp, docx_path)
    return embedded


def _ensure_default_ct(items: dict[str, bytes], ext: str, ctype: str) -> None:
    ct = etree.fromstring(items["[Content_Types].xml"])
    for d in ct.findall(f"{{{CT_NS}}}Default"):
        if d.get("Extension", "").lower() == ext:
            return
    el = etree.Element(f"{{{CT_NS}}}Default")
    el.set("Extension", ext)
    el.set("ContentType", ctype)
    ct.insert(0, el)
    items["[Content_Types].xml"] = etree.tostring(ct, xml_declaration=True, encoding="UTF-8", standalone=True)


def _ensure_override(items: dict[str, bytes], part: str, ctype: str) -> None:
    ct = etree.fromstring(items["[Content_Types].xml"])
    for o in ct.findall(f"{{{CT_NS}}}Override"):
        if o.get("PartName") == part:
            return
    el = etree.SubElement(ct, f"{{{CT_NS}}}Override")
    el.set("PartName", part)
    el.set("ContentType", ctype)
    items["[Content_Types].xml"] = etree.tostring(ct, xml_declaration=True, encoding="UTF-8", standalone=True)


def _ensure_doc_rel(items: dict[str, bytes], rtype: str, target: str) -> None:
    name = "word/_rels/document.xml.rels"
    rels = etree.fromstring(items[name])
    for r in rels:
        if r.get("Type") == rtype:
            return
    el = etree.SubElement(rels, f"{{{PKG_REL_NS}}}Relationship")
    el.set("Id", "rIdFontTable")
    el.set("Type", rtype)
    el.set("Target", target)
    items[name] = etree.tostring(rels, xml_declaration=True, encoding="UTF-8", standalone=True)


# order of the first children of w:settings (ECMA-376 CT_Settings)
_SETTINGS_BEFORE_EMBED = {
    "writeProtection", "view", "zoom", "removePersonalInformation", "removeDateAndTime",
    "doNotDisplayPageBoundaries", "displayBackgroundShape", "printPostScriptOverText",
    "printFractionalCharacterWidth", "printFormsData",
}


def _enable_embed_setting(items: dict[str, bytes]) -> None:
    name = "word/settings.xml"
    if name not in items:
        return
    settings = etree.fromstring(items[name])
    if settings.find(f"{{{W_NS}}}embedTrueTypeFonts") is not None:
        return
    el = etree.Element(f"{{{W_NS}}}embedTrueTypeFonts")
    idx = 0
    for i, child in enumerate(settings):
        local = etree.QName(child).localname
        if local in _SETTINGS_BEFORE_EMBED:
            idx = i + 1
    settings.insert(idx, el)
    items[name] = etree.tostring(settings, xml_declaration=True, encoding="UTF-8", standalone=True)
