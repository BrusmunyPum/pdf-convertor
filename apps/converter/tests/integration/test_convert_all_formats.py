"""Every output format end to end on a small generated PDF (text + a ruled table)."""

from pathlib import Path

import fitz
import pytest
from docx import Document

from app.core import config
from app.pipeline import service

HTML = """
<h1>Quarterly report</h1>
<p>The quick brown fox jumps over the lazy dog.</p>
<table border="1">
  <tr><th>No</th><th>Name</th><th>Score</th></tr>
  <tr><td>1</td><td>Sok Sophea</td><td>95</td></tr>
  <tr><td>2</td><td>Keo Chanda</td><td>88</td></tr>
</table>
"""


@pytest.fixture()
def sample_pdf(tmp_path, monkeypatch) -> Path:
    monkeypatch.setattr(config, "DATA_DIR", tmp_path.resolve())
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_htmlbox(fitz.Rect(50, 50, 545, 800), HTML, css="* {font-family: sans-serif; font-size: 12px}")
    # draw the table grid so it is a real ruled table
    for y in (147, 167, 187, 207):
        page.draw_line((50, y), (300, y))
    path = tmp_path / "sample.pdf"
    doc.save(path)
    return path


@pytest.mark.parametrize(
    "target,mode",
    [("docx", "flow"), ("docx", "exact"), ("pptx", "flow"), ("xlsx", "flow"),
     ("csv", "flow"), ("txt", "flow"), ("png", "flow"), ("jpg", "flow")],
)
def test_every_format(sample_pdf: Path, tmp_path: Path, target: str, mode: str):
    result = service.convert(
        "test", str(sample_pdf), str(tmp_path / f"out_{target}_{mode}"), target, "sample",
        {"mode": mode, "ocr": "off", "dpi": 100, "embedFonts": False},
    )
    out = Path(result["outputPath"])
    assert out.exists() and out.stat().st_size > 0
    assert result["pages"] == 1
    if target == "txt":
        assert "quick brown fox" in out.read_text(encoding="utf-8-sig")
    if target == "docx" and mode == "flow":
        text = "\n".join(p.text for p in Document(str(out)).paragraphs)
        assert "Quarterly report" in text


def test_rejects_paths_outside_data_dir(sample_pdf: Path):
    with pytest.raises(service.ConversionError) as err:
        service.convert("t", "/etc/passwd", "/tmp/x", "txt", "x", {})
    assert err.value.code == "BAD_PATH"


def test_inspect(sample_pdf: Path):
    info = service.inspect(str(sample_pdf), None)
    assert info["pages"] == 1 and not info["encrypted"]
