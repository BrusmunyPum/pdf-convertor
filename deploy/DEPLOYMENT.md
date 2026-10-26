# DIGITECHKH PDF Converter — Ubuntu deployment
# ការដំឡើង PDF Converter លើ Ubuntu Server (ជាមួយ BMS)

This stack runs on the same Ubuntu server as DIGITECHKH BMS. It shares the BMS PostgreSQL **server** but uses **its own database and user**. Its gateway listens on port **4900** (BMS: 4600), so nothing collides.

---

## 1. Architecture / រចនាសម្ព័ន្ធ

```text
Internet ──HTTPS──► Cloudflare Tunnel (or host nginx + Certbot)
                         │  http://localhost:4900
                         ▼
   digitechkh-pdf-gateway   nginx :4900 → :80   (/healthz, rate limits, real visitor IP)
        ├── /api/socket.io/  ─► digitechkh-pdf-api        NestJS :3000 (live updates)
        ├── /api/*           ─► digitechkh-pdf-api        NestJS :3000
        │                          ├─► digitechkh-pdf-redis      queue (internal)
        │                          ├─► digitechkh-pdf-converter  Python :8000 (internal)
        │                          └─► host.docker.internal:5434 ─► shared PostgreSQL (same as BMS)
        │                                                           database: pdf_convertor_db
        └── /*               ─► digitechkh-pdf-web        Vue SPA :80
```

| | BMS | PDF Converter |
|---|---|---|
| Compose project | `digitechkh-bms` | `digitechkh-pdf` |
| Gateway port | `4600` | **`4900`** |
| PostgreSQL server | `host.docker.internal:5434` | same server |
| Database / user | `bms_db_v2` / BMS user | `pdf_convertor_db` / `pdf_convertor` (never the BMS user) |
| Containers | `digitechkh-bms-*` | `digitechkh-pdf-*` |
| Redis | — | own container, not published |

Only port 4900 is published. The API, converter and Redis are reachable only inside the stack.

---

## 2. Before you start / មុនពេលចាប់ផ្តើម

On the server, Docker Engine with the Compose plugin must be installed (it already is if BMS runs there):

```bash
docker --version && docker compose version
```

**Check that containers can reach the shared PostgreSQL** the same way BMS does:

```bash
docker run --rm --add-host host.docker.internal:host-gateway postgres:18-alpine \
  pg_isready -h host.docker.internal -p 5434
# expected: host.docker.internal:5434 - accepting connections
```

If it says `no response`:
- **PostgreSQL runs in Docker** and its port is published as `127.0.0.1:5434:5432`: containers cannot reach that. Publish it as `5434:5432`, and block it from the internet with the firewall (`sudo ufw deny 5434`). Or connect this stack to the PostgreSQL container's network and set `POSTGRES_HOST=<postgres container name>` and `POSTGRES_PORT=5432` in `.env`.
- **PostgreSQL is installed on Ubuntu** (apt): in `postgresql.conf` set `listen_addresses = '*'`. In `pg_hba.conf` add:
  `host  pdf_convertor_db  pdf_convertor  172.16.0.0/12  scram-sha-256`
  Then run `sudo systemctl reload postgresql`.

---

## 3. Copy the project to the server / ចម្លងគម្រោងទៅ Server

The guide uses `/opt/digitechkh/pdf-converter`.

**With git (recommended):**
```bash
sudo mkdir -p /opt/digitechkh && sudo chown $USER /opt/digitechkh
git clone <your-repo-url> /opt/digitechkh/pdf-converter
```

**Without git**, from your Windows PC (Git Bash), in `D:\Research\PDF-CONVERTOR`:
```bash
tar --exclude=node_modules --exclude=dist --exclude=.venv --exclude=__pycache__ --exclude=.env -czf pdf-converter.tgz .
scp pdf-converter.tgz user@SERVER:/tmp/
```
Then on the server:
```bash
sudo mkdir -p /opt/digitechkh/pdf-converter && sudo chown -R $USER /opt/digitechkh
tar -xzf /tmp/pdf-converter.tgz -C /opt/digitechkh/pdf-converter
```

Then make the scripts executable:
```bash
cd /opt/digitechkh/pdf-converter/deploy
chmod +x *.sh
```

**Extra Khmer fonts (optional):** put `.ttf` / `.otf` files in `/opt/digitechkh/pdf-converter/fonts/`. They are embedded in DOCX output. The `fonts/` folder is not in git, so copy it separately.

---

## 4. Configure `.env` / កំណត់ `.env`

```bash
cd /opt/digitechkh/pdf-converter/deploy
cp .env.example .env
# generate the secrets:
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "COOKIE_SECRET=$(openssl rand -hex 32)"
nano .env
```

Change at least:

| Key | Value |
|---|---|
| `POSTGRES_HOST` / `POSTGRES_PORT` | the same as in BMS's `.env` (default `host.docker.internal` / `5434`) |
| `POSTGRES_PASSWORD`, `JWT_SECRET`, `COOKIE_SECRET` | the generated values |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | your first admin login |
| `PUBLIC_URL` | e.g. `https://pdf.digitechkh.site` |
| `COOKIE_SECURE` | `true` behind HTTPS. Set `false` only while testing on `http://SERVER_IP:4900`, otherwise login silently fails. |
| `BIND_ADDRESS` | `127.0.0.1` if only Cloudflare Tunnel / a host proxy on this server connects (recommended) |

```bash
chmod 600 .env
```

---

## 5. Create the database (once) / បង្កើត Database

```bash
./setup-database.sh
```

The script asks for a PostgreSQL admin account (`postgres`, or the account BMS's database was created with). It creates the `pdf_convertor` user and the `pdf_convertor_db` database and checks that the new user can sign in. BMS's database is not touched. Tables are created automatically by the API on first start (Prisma migrations).

---

## 6. Build and start / Build និងដំណើរការ

```bash
./rebuild.sh
```

The first build takes **10–20 minutes** (the converter installs Tesseract OCR and downloads the Khmer fonts). Later rebuilds are much faster. When it prints `OK: http://127.0.0.1:4900 is up`:

```bash
curl http://127.0.0.1:4900/healthz
docker compose ps          # all should be "healthy"
```

Sign in at `/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then open `/admin`.

---

## 7. Domain + HTTPS / ភ្ជាប់ Domain

### Option A — Cloudflare Tunnel (same as BMS)
In Cloudflare Zero Trust → **Networks → Tunnels**, open the tunnel already used for BMS → **Public Hostnames → Add a public hostname**:
- Subdomain: `pdf`, Domain: `digitechkh.site`
- Service: `HTTP` → `localhost:4900`

Use the same kind of address BMS uses: `localhost:4600` for BMS means `localhost:4900` here. If cloudflared runs in a container on its own network, use the server's LAN IP instead.

Then keep `BIND_ADDRESS=127.0.0.1` and `COOKIE_SECURE=true`. Cloudflare's free plan limits uploads to 100 MB, which is above `MAX_FILE_MB=50`.

### Option B — nginx on the host with Let's Encrypt
`/etc/nginx/sites-available/pdf.digitechkh.site`:
```nginx
server {
    server_name pdf.digitechkh.site;
    client_max_body_size 110M;

    location / {
        proxy_pass http://127.0.0.1:4900;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/pdf.digitechkh.site /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d pdf.digitechkh.site
```

### Firewall
- With a tunnel or host proxy: do not open 4900 (`BIND_ADDRESS=127.0.0.1`).
- Direct access by IP: `sudo ufw allow 4900/tcp`.

---

## 8. Daily operations / ការប្រើប្រាស់ប្រចាំថ្ងៃ

| Task | Command (in `deploy/`) |
|---|---|
| Update after code changes | `git pull && ./rebuild.sh` (or `./rebuild.sh web` / `api` / `converter`) |
| Reload after editing `nginx/conf.d` | `./rebuild.sh gateway` |
| Status | `docker compose ps` |
| Logs | `docker compose logs -f --tail=100 api` (or `converter`, `gateway`, `web`) |
| Restart one service | `docker compose restart api` |
| Stop everything | `docker compose down` (data is kept) |
| Change `.env` | edit it, then `docker compose up -d` |

### Backups
```bash
./backup-database.sh                # → deploy/backups/pdf_convertor_db-YYYYMMDD-HHMMSS.dump (keeps 14)
crontab -e                          # daily at 02:30:
30 2 * * * /opt/digitechkh/pdf-converter/deploy/backup-database.sh >> /var/log/pdf-backup.log 2>&1
```
The restore command is at the top of `backup-database.sh`. Uploaded and converted files are temporary (deleted after their TTL), so they are not backed up.

---

## 9. Troubleshooting / ដោះស្រាយបញ្ហា

| Symptom | Cause / fix |
|---|---|
| `api` restarts, log shows `P1001 Can't reach database server` | PostgreSQL not reachable from containers: see section 2. |
| `P1000 Authentication failed` | `.env` password differs from the database: run `./setup-database.sh` again (it resets the password). |
| Login does nothing / returns to login | `COOKIE_SECURE=true` while using `http://`. Use HTTPS, or set `false` for testing, then `docker compose up -d api`. |
| 502 Bad Gateway | A service is still starting or crashed: `docker compose ps`, then the logs of that service. |
| Conversions stay "waiting" | `docker compose logs converter`. Large OCR jobs may need more memory: raise `CONVERTER_MEM_LIMIT`. |
| Every guest hits "daily limit" at once | The visitor IP is wrong: the proxy in front must send `X-Forwarded-For`, and come from this server or a private network (see `set_real_ip_from` in `nginx/nginx.conf`). |
| `413 Request Entity Too Large` | Raise `client_max_body_size` in `nginx/nginx.conf` (and in the host nginx), then `./rebuild.sh gateway`. |
