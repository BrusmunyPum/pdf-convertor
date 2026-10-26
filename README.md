# PDF ខ្មែរ — Khmer PDF Converter

A website where people upload a PDF and get back **Word (DOCX), PowerPoint (PPTX), Excel (XLSX), CSV, TXT, PNG or JPG**.
It is built for **Khmer documents**: the converted file keeps the original fonts, layout, colours and pages, and the Khmer text comes out as correct Unicode.

```
Browser ──► nginx ──► /api ──► NestJS API ──► PostgreSQL (users, jobs, credits)
            │                     │
            │                     └─► Redis + BullMQ (conversion queue)
            │                               │
            └─ Vue 3 app (static)           └─► Python converter (PyMuPDF, pdf2docx, Tesseract OCR)
                                                 shared volume /data (uploads + results)
```

## Stack and why

| Part | Choice | Why |
|---|---|---|
| Frontend | **Vue 3 + Vite + Pinia + Tailwind CSS 4** | Fast and small (~56 KB gzipped core); every page is lazy-loaded |
| Font / icons | **Kantumruy Pro** (self-hosted via Fontsource), **MDI** as inline SVG (`@mdi/js`) | No icon-font download; only the icons you use ship |
| API | **NestJS 11 + Prisma 6** | Typed, modular. Prisma handles migrations and safe queries |
| Database | **PostgreSQL 17** | Users, jobs, credit ledger, credit requests, settings |
| Queue | **Redis + BullMQ** *(added)* | Conversions take seconds to minutes. A queue keeps the API fast and limits CPU load (`QUEUE_CONCURRENCY`) |
| Converter | **Python service** *(added)* | The best PDF libraries are Python-only: PyMuPDF, pdf2docx, python-docx/pptx, openpyxl, Tesseract |
| Proxy | **nginx** | Serves the built Vue app, proxies `/api`, gzip, upload size limit |

## Project structure

```
apps/
  web/                         Vue 3 website
    src/
      api/                     typed endpoint helpers (conversions…)
      services/                http.ts (fetch + upload with progress), realtime.ts (Socket.IO client)
      stores/                  Pinia: session (user, live credits), jobs (live job states), toast
      composables/             useUploadQueue (multi-file upload + convert queue)
      components/ ui/ layout/ converter/
      layouts/  pages/  pages/admin/  router/  constants/  types/  utils/  assets/styles/
  api/                         NestJS API
    src/
      config/env.ts            every environment setting in one place
      common/                  constants, errors, decorators, guards, middleware, utils, serializers, dto
      prisma/                  PrismaService
      modules/
        auth/ users/ credits/ settings/ telegram/ admin/
        conversions/           controller, service, queue processor, cleanup cron, converter client, storage, dto/
        realtime/              WebSocket gateway + service (job progress, credits, admin events)
    prisma/                    schema + migrations
  converter/                   Python conversion service (FastAPI)
    app/
      api/                     routes + request schemas
      core/                    config + logging
      khmer/                   Unicode order repair, font names, symbol fonts
      fonts/                   font library, DOCX font embedding, glyphmap (text-layer repair)
      pipeline/                analyze, layout, OCR, textfix, service (orchestration)
      exporters/               docx_flow, docx_exact, pptx, tables (xlsx/csv), text, images, pdf2docx patches
    tests/unit/  tests/integration/
nginx/                         reverse proxy (static site, /api, WebSocket)
scripts/smoke-test.mjs         end-to-end test against a running stack
fonts/                         extra fonts mounted into the converter
```

## Live updates (WebSocket)

The browser keeps one Socket.IO connection at `/api/socket.io`. It's authenticated with the same cookies as the API, so a browser only receives its own events:

| Event | Who gets it | Used for |
|---|---|---|
| `job:update` | owner of the job | progress %, stage, done/failed (home page, history) |
| `job:removed` | owner | history list |
| `credits:update` | user or guest | credit badge in the header |
| `admin:credit-request` | admins | pending-requests badge, requests page |
| `admin:job` | admins | live conversions log |

If WebSocket is blocked on a network, the pages fall back to polling automatically.

## Quick start (Docker)

```bash
cp .env.example .env        # then change every password/secret in .env
docker compose up -d --build
```

Open <http://localhost:8080>. Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` to reach the admin panel at `/admin`.

## Roles

**Everyone**
- Pick several PDFs at once (or keep adding). Each file has its own row with live progress and a download button, and all results can be downloaded as one ZIP.
- Choosing another format after converting reuses the uploaded files (no re-upload); the one main button always says exactly what will happen.

**Guest (no account)**
- Can convert right away. Gets `GUEST_FREE_CREDITS` free conversions (default 3), counted per browser and capped per IP per day.
- Sees their recent conversions in **History**. When they register or sign in, those conversions move into their account.

**User**
- Gets `SIGNUP_FREE_CREDITS` (default 20) on sign-up. 1 conversion = 1 credit, and a failed conversion is refunded automatically.
- **History**: search and filter, download again, convert the same PDF to another format, delete.
- **Credits**: balance, full ledger, and **request more credits**. The request gets a code (e.g. `CR-7K2QM9`) and a button that opens Telegram to the admin with a pre-filled message. No online payment.
- **Profile**: name, Telegram username, password.

**Admin**
- **Dashboard**: users, conversions, success rate, last 14 days, use by format.
- **Credit requests**: approve (you can change the amount) or reject, with a note the user sees.
- **Users**: search, add or remove credits, suspend, promote to admin, see each user's conversions and requests.
- **Conversions**: every job with errors and warnings.
- **Settings**: free credits, limits, file retention, Telegram username, home-page announcement, open or close registration.
- Optional: set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_CHAT_ID` to get a Telegram message whenever someone requests credits.

## How conversion quality is achieved

1. **Khmer text-layer repair.** Word and PowerPoint write a broken `/ToUnicode` table for Khmer, so a normal converter outputs `សសចក្ដី` instead of `សេចក្ដី`. The converter matches every glyph in the PDF to the same glyph in a full copy of the font **by its outline**, which works even when the PDF was made with another version of the font. It then rebuilds the right characters from the font's cmap + GSUB tables and puts pre-base vowels (េ ែ ៃ), the left subscript ro (្រ), split vowels (ោ ៅ ើ ៀ ឿ) and subscripts back into Unicode order. See `apps/converter/app/glyphmap.py` and `khmer.py`.
   - When the exact font isn't on the server, only the lines drawn in that font are re-read by **line-level OCR** from a clean render of the page with pictures removed (`textfix.py`). Everything else keeps the exact text.
   - Font shape indexes are cached in the data volume (`/data/.font-index`), so a large `fonts/` folder only costs time once.
   - Symbol-font bullets (Wingdings, Symbol) become real Unicode (❖ ➢ ▪ ✓) in TXT / CSV / Excel.
2. **Fonts kept.** PDF font names such as `BCDEEE+KhmerOSBattambang-Bold` become real family names (`Khmer OS Battambang`, bold). Khmer runs get the complex-script font, size and `km-KH` language that Word needs. Khmer fonts available on the server are **embedded in the DOCX**, so the file looks the same on computers that don't have the font installed.
3. **Two Word modes.**
   - *Editable (flow)*: real paragraphs, tables and images that are easy to edit. Khmer paragraphs use the PDF's exact line pitch (Word's "single" line is much taller for Khmer fonts, which made pages drift down). Images that stick out of the page are placed back as floating pictures, and a pdf2docx tab-stop bug that pushed centred lines to the left is patched.
   - *Exact*: every page keeps its exact look. The page artwork (images, shapes, lines) sits behind the text, and every text line is an editable text frame at its original position.
4. **PowerPoint**: one slide per page, built like the exact mode, so it matches the PDF and the text stays editable.
5. **Excel / CSV**: ruled tables are detected, including merged cells and cell colours. CSV is UTF-8 with a BOM so Excel opens Khmer correctly.
6. **Scanned pages and broken fonts** go through **Tesseract OCR (Khmer + English)** automatically.

Tested on a Word-exported Khmer PDF (Khmer UI, MoolBoran, Times New Roman, Arial, plus a table). The DOCX (both modes) and the PPTX, re-opened in Microsoft Word and PowerPoint, rendered the same as the original. The extracted Khmer text was correct.

### Fonts: important for the best result

To repair Khmer text and embed fonts, the converter needs the **same font files** the PDF used. The Docker image already includes the **Khmer OS** family and **Noto Khmer**. Copy any other fonts your users' PDFs use into `./fonts/` (mounted into the converter), for example:

- `KhmerUI.ttf`, `daunpenh.ttf`, `moolbor.ttf` (from `C:\Windows\Fonts`; check that their license allows this)
- **Khmer MEF1 / MEF2** (very common in Cambodian government documents)
- Kantumruy Pro, Battambang, Siemreap, Moul, Koulen… (Google Fonts, OFL)

Then run `docker compose restart converter`.

### Honest limits

- No converter is 100% for every PDF. **Exact** mode and PPTX give the closest look. Flow mode is best for editing but can move complex layouts slightly.
- Scanned documents depend on scan quality, because Khmer OCR is good but not perfect. The same goes for lines in a font the server doesn't have (e.g. *Khmer OS Battambang **Bold***). Add that font file to `fonts/` and those lines are repaired exactly instead of OCR'd.
- PDFs made with **legacy non-Unicode fonts (Limon, ABC)** go through OCR. A direct Limon→Unicode mapper would be a good next feature.

## Development without Docker

```bash
# infrastructure
docker compose up -d postgres redis

# converter (Python 3.12+, dependencies managed by uv: https://docs.astral.sh/uv/)
cd apps/converter && uv sync                               # creates .venv exactly as pinned in uv.lock
DATA_DIR=../../data uv run uvicorn app.main:app --port 8000

# API
cd apps/api && npm install && npx prisma migrate deploy && npm run start:dev
#   needs DATABASE_URL, REDIS_HOST, CONVERTER_URL, DATA_DIR (same folder as the converter), JWT_SECRET, COOKIE_SECRET

# web
cd apps/web && npm install && npm run dev      # http://localhost:5173 (proxies /api to :3000)
```

Python dependencies (converter):

```bash
uv add <package>==<version>     # add a dependency (updates pyproject.toml + uv.lock)
uv lock --upgrade-package <pkg> # upgrade one package on purpose
uv sync                         # make .venv match uv.lock
```

`uv.lock` pins every package, including sub-dependencies, so Docker, your PC and the server install identical versions. Docker builds keep downloaded packages in a BuildKit cache, so changing one dependency only downloads that one.

Tests:

```bash
cd apps/converter && uv run pytest                          # unit + all-formats integration tests
node scripts/smoke-test.mjs --email you@example.com --password '...' a.pdf b.pdf   # full stack, live events, ZIP
```

## Before going live

To host it on the Ubuntu server next to DIGITECHKH BMS (shared PostgreSQL, gateway on port 4900), follow [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md).

- Change every secret in `.env`. Put the site behind HTTPS (e.g. Caddy, or Cloudflare in front of nginx) and set `COOKIE_SECURE=true`.
- Back up the `pgdata` volume. Uploaded and converted files are temporary and are deleted after `GUEST_FILE_TTL_HOURS` / `USER_FILE_TTL_HOURS`.
- **Licensing:** PyMuPDF is **AGPL-3.0** (or a paid Artifex license). Running it in a public web service means you must publish this project's source code under the AGPL, or buy a commercial license from Artifex. pdf2docx and docxcompose are MIT.
