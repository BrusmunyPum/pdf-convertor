"""Converter HTTP service (internal; only the NestJS API talks to it)."""

from __future__ import annotations

import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api.routes import router
from .core.logging import setup_logging
from .fonts import glyphmap

setup_logging()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # index all Khmer fonts in the background so the first conversion is fast
    threading.Thread(target=glyphmap.warm_up, daemon=True).start()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Khmer PDF converter", docs_url=None, redoc_url=None, lifespan=lifespan)
    app.include_router(router)
    return app


app = create_app()
