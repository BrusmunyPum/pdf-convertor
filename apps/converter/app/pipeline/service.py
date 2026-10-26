"""Conversion orchestration: repair the Khmer text layer, analyse pages, run an exporter.

Independent of HTTP: errors are raised as ConversionError and mapped by the API layer.
"""

from __future__ import annotations

import json
import logging
import re
import time
from pathlib import Path

import fitz

from ..core import config
from ..exporters import docx_exact, docx_flow, images, pptx, tables, text
from ..fonts import glyphmap
from . import analyze, ocr, textfix

log = logging.getLogger(__name__)


class ConversionError(Exception):
    def __init__(self, code: str, message: str, status: int = 422):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def safe_path(path: str) -> Path:
    """Only files inside the shared data folder may be read or written."""
    p = Path(path).resolve()
    if config.DATA_DIR not in p.parents and p != config.DATA_DIR:
        raise ConversionError("BAD_PATH", "path outside data dir", 400)
    return p


def safe_base_name(name: str) -> str:
    name = re.sub(r"[\\/:*?\"<>|\x00-\x1f]", "_", name).strip(" .") or "converted"
    return name[:120]


def open_pdf(path: Path, password: str | None) -> fitz.Document:
    try:
        doc = fitz.open(str(path))
    except Exception as exc:
        raise ConversionError("INVALID_PDF", str(exc))
    if not doc.is_pdf:
        raise ConversionError("INVALID_PDF", "not a PDF")
    if doc.needs_pass and not doc.authenticate(password or ""):
        raise ConversionError("PASSWORD_REQUIRED", "PDF is password protected")
    return doc


def inspect(input_path: str, password: str | None) -> dict:
    doc = open_pdf(safe_path(input_path), password)
    pages = list(doc) if len(doc) <= 30 else [doc[i] for i in range(10)]
    infos = [analyze.analyze_page(p) for p in pages]
    result = {
        "pages": len(doc),
        "encrypted": doc.is_encrypted,
        "scannedPages": [i.index + 1 for i in infos if i.kind == "scanned"],
        "garbledPages": [i.index + 1 for i in infos if i.kind == "garbled"],
        "khmer": any(i.khmer_ratio > 0.05 for i in infos),
        "fonts": sorted({f for i in infos for f in i.fonts})[:50],
    }
    doc.close()
    return result


def convert(job_id: str, input_path: str, output_dir: str, target: str, base_name: str, options: dict) -> dict:
    if target not in config.FORMATS:
        raise ConversionError("BAD_FORMAT", "unsupported target", 400)
    src = safe_path(input_path)
    out_dir = safe_path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    progress_file = out_dir / "progress.json"
    opts = dict(options)
    password = opts.get("password")
    base = safe_base_name(base_name)
    started = time.time()

    reported = {"value": 0}

    def progress(frac: float, message: str) -> None:
        # read by the API, which pushes it to the browser over WebSocket; never goes backwards
        # (exporters report their own 0..1 range after the repair/analysis steps)
        value = max(reported["value"], round(10 + frac * 85))
        reported["value"] = value
        try:
            progress_file.write_text(json.dumps({"progress": value, "message": message}))
        except OSError:
            pass

    open_pdf(src, password).close()
    progress(0, "Repairing Khmer text layer")
    pdf = str(src)
    repaired_fonts: list[str] = []
    unreliable: set[str] = set()
    repaired_path = out_dir / "_repaired.pdf"
    try:
        repaired_fonts, unreliable = glyphmap.repair_file(pdf, str(repaired_path), password)
        if repaired_fonts:
            pdf = str(repaired_path)
            opts["password"] = None
    except Exception:
        log.exception("text layer repair failed; using original")

    progress(0.02, "Analysing pages")
    doc = fitz.open(pdf)
    if doc.needs_pass:
        doc.authenticate(password or "")
    infos = analyze.analyze(doc)
    page_count = len(doc)
    doc.close()

    fixer = textfix.TextFixer(pdf, {i.index: i.order for i in infos}, unreliable, use_ocr=opts.get("ocr") != "off")
    textfix.activate(fixer)
    try:
        out, warnings = _export(target, pdf, out_dir, base, infos, opts, progress)
    except ConversionError:
        raise
    except Exception as exc:
        log.exception("conversion failed job=%s", job_id)
        raise ConversionError("CONVERSION_FAILED", str(exc)[:500], 500)
    finally:
        textfix.activate(None)
        fixer.close()
        repaired_path.unlink(missing_ok=True)

    progress(1, "Done")
    return {
        "outputPath": str(out),
        "fileName": out.name,
        "size": out.stat().st_size,
        "pages": page_count,
        "warnings": warnings,
        "quality": {
            "scannedPages": [i.index + 1 for i in infos if i.kind == "scanned"],
            "garbledPages": [i.index + 1 for i in infos if i.kind == "garbled"],
            "khmerOrderFixed": any(i.order == "visual" for i in infos),
            "repairedFonts": repaired_fonts,
            "unrepairedFonts": sorted(unreliable),
            "ocrSpans": fixer.ocr_spans,
            "ocrUsed": ocr.available() and any(i.needs_ocr for i in infos) and opts.get("ocr") != "off",
        },
        "durationMs": int((time.time() - started) * 1000),
    }


def _export(target, pdf, out_dir: Path, base, infos, opts, progress) -> tuple[Path, list[str]]:
    if target == "docx":
        out = out_dir / f"{base}.docx"
        exporter = docx_exact if opts.get("mode") == "exact" else docx_flow
        return out, exporter.convert(pdf, str(out), infos, opts, progress)
    if target == "pptx":
        out = out_dir / f"{base}.pptx"
        return out, pptx.convert(pdf, str(out), infos, opts, progress)
    if target == "xlsx":
        out = out_dir / f"{base}.xlsx"
        return out, tables.to_xlsx(pdf, str(out), infos, opts, progress)
    if target == "csv":
        path, warnings = tables.to_csv(pdf, str(out_dir), base, infos, opts, progress)
        return Path(path), warnings
    if target == "txt":
        out = out_dir / f"{base}.txt"
        return out, text.to_txt(pdf, str(out), infos, opts, progress)
    return Path(images.to_images(pdf, str(out_dir), base, target, opts, progress)), []
