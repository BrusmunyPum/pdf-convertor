from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .. import fonts
from ..pipeline import ocr, service
from .schemas import ConvertRequest, InspectRequest

router = APIRouter()


def _http(err: service.ConversionError) -> HTTPException:
    return HTTPException(err.status, {"code": err.code, "message": err.message})


@router.get("/health")
def health():
    return {"ok": True, "ocr": ocr.available(), "fonts": len(fonts.font_library())}


@router.get("/fonts")
def list_fonts():
    return sorted(f.name for f in fonts.font_library().values())


# plain `def` endpoints run in FastAPI's thread pool, so one slow PDF doesn't block the others
@router.post("/inspect")
def inspect(req: InspectRequest):
    try:
        return service.inspect(req.inputPath, req.password)
    except service.ConversionError as err:
        raise _http(err)


@router.post("/convert")
def convert(req: ConvertRequest):
    try:
        return service.convert(
            req.jobId, req.inputPath, req.outputDir, req.target, req.baseName, req.options.model_dump()
        )
    except service.ConversionError as err:
        raise _http(err)
