from __future__ import annotations

from pydantic import BaseModel, Field


class Options(BaseModel):
    mode: str = Field("flow", pattern="^(flow|exact)$")
    ocr: str = Field("auto", pattern="^(auto|force|off)$")
    dpi: int = Field(200, ge=72, le=400)
    embedFonts: bool = True
    password: str | None = None


class ConvertRequest(BaseModel):
    jobId: str
    inputPath: str
    outputDir: str
    target: str
    baseName: str = "converted"
    options: Options = Options()


class InspectRequest(BaseModel):
    inputPath: str
    password: str | None = None
