# syntax=docker/dockerfile:1
FROM ghcr.io/astral-sh/uv:0.13.5 AS uv

FROM python:3.12-slim-bookworm

COPY --from=uv /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    # uv: compile .pyc at install time, copy (not link) from the cache mount, use this image's Python
    UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

# Tesseract OCR (Khmer + English) and Unicode Khmer fonts (Khmer OS family, Noto Khmer)
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr tesseract-ocr-khm tesseract-ocr-eng \
        fonts-khmeros fonts-noto-core fonts-dejavu-core \
        libglib2.0-0 libgomp1 curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Use the more accurate "best" Khmer OCR model when it can be downloaded
RUN TESSDIR=$(dirname $(find /usr/share/tesseract-ocr -name eng.traineddata | head -1)) \
    && (curl -fsSL -o /tmp/khm.traineddata https://github.com/tesseract-ocr/tessdata_best/raw/main/khm.traineddata \
        && mv /tmp/khm.traineddata "$TESSDIR/khm.traineddata" || echo "using packaged khm model")

# Free Khmer fonts: more fonts = more PDFs whose Khmer text can be repaired exactly + embedded in DOCX
COPY google-fonts.txt /tmp/google-fonts.txt
RUN mkdir -p /usr/share/fonts/truetype/google-khmer && cd /usr/share/fonts/truetype/google-khmer \
    && grep -v '^#' /tmp/google-fonts.txt | while read -r f; do \
         [ -z "$f" ] && continue; \
         name=$(basename "$f" | sed 's/%5B/[/g; s/%5D/]/g; s/%2C/,/g'); \
         curl -fsSL -o "$name" "https://github.com/google/fonts/raw/main/ofl/$f" || echo "WARN: could not download $f"; \
       done; \
    echo "google khmer fonts: $(ls | wc -l)"

WORKDIR /app

# Dependencies first, exactly as pinned in uv.lock. The cache mount keeps downloaded
# packages between builds, so changing one dependency only downloads that one.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY app ./app
RUN mkdir -p /app/fonts /data

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-2} --timeout-keep-alive 30"]
