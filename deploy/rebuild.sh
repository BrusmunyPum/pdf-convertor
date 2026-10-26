#!/usr/bin/env bash
# ==============================================================================
# DIGITECHKH PDF Converter - build and (re)start the stack
# ==============================================================================
# Usage:
#   ./rebuild.sh             # build + start everything (also the first install)
#   ./rebuild.sh api         # only the NestJS API
#   ./rebuild.sh web         # only the Vue frontend
#   ./rebuild.sh converter   # only the Python converter
#   ./rebuild.sh gateway     # reload the gateway after editing nginx/conf.d
# ==============================================================================

set -eo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "ERROR: deploy/.env not found. Run: cp .env.example .env  and fill it in."; exit 1; }
if grep -qE '^(POSTGRES_PASSWORD|JWT_SECRET|COOKIE_SECRET|ADMIN_PASSWORD)=change-me' .env; then
  echo "ERROR: .env still has change-me values (POSTGRES_PASSWORD, JWT_SECRET, COOKIE_SECRET, ADMIN_PASSWORD)."
  exit 1
fi

TARGET=${1:-all}
echo "--------------------------------------------------------"
echo " DIGITECHKH PDF Converter rebuild: $TARGET"
echo "--------------------------------------------------------"

case $TARGET in
  api|web|converter)
    docker compose build "$TARGET"
    docker compose up -d --no-deps "$TARGET"
    ;;
  gateway)
    docker compose up -d gateway
    docker exec digitechkh-pdf-gateway nginx -t
    docker exec digitechkh-pdf-gateway nginx -s reload
    ;;
  all)
    docker compose build
    docker compose up -d --remove-orphans
    ;;
  *)
    echo "ERROR: unknown target '$TARGET'. Use: ./rebuild.sh [all|api|web|converter|gateway]"
    exit 1
    ;;
esac

echo "==> Waiting for the services to become healthy..."
for _ in $(seq 1 60); do
  if ! docker compose ps --format '{{.Health}}' | grep -qE 'starting|unhealthy'; then break; fi
  sleep 3
done

docker compose ps
PORT=$(grep -E '^PORT_HTTP=' .env | cut -d= -f2); PORT=${PORT:-4900}
if curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && curl -fsS "http://127.0.0.1:$PORT/api/config" >/dev/null 2>&1; then
  echo "OK: http://127.0.0.1:$PORT is up"
else
  echo "WARNING: http://127.0.0.1:$PORT is not answering yet. Check: docker compose logs --tail=100 api"
  exit 1
fi
