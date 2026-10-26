"""Helpers shared by all exporters."""

from __future__ import annotations

from typing import Callable

import fitz

from ..khmer import symbols
from ..pipeline import layout


Progress = Callable[[float, str], None]


def open_pdf(pdf_path: str, options: dict) -> fitz.Document:
    doc = fitz.open(pdf_path)
    if doc.needs_pass:
        doc.authenticate(options.get("password") or "")
    return doc


def line_text(line: layout.Line) -> str:
    """Final plain text of a line: fixed Khmer, symbol fonts as real Unicode."""
    return "".join(symbols.to_unicode(sp.text, sp.font) for sp in line.spans)
