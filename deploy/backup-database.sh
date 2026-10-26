#!/usr/bin/env bash
# ==============================================================================
# DIGITECHKH PDF Converter - back up its database (users, credits, history, settings)
# ==============================================================================
# Usage:  ./backup-database.sh [backup-dir]       (default: ./backups, keeps the last 14)
# Daily at 02:30 (crontab -e):
#   30 2 * * * /opt/digitechkh/pdf-converter/deploy/backup-database.sh >> /var/log/pdf-backup.log 2>&1
# Restore:
#   docker run --rm -i -e PGPASSWORD=<POSTGRES_PASSWORD> --add-host host.docker.internal:host-gateway postgres:18-alpine \
#     pg_restore --clean --if-exists -h host.docker.internal -p 5434 -U pdf_converter -d pdf_converter < backups/<file>.dump
# Uploaded / converted files are temporary (deleted after their TTL), so they are not backed up.
# ==============================================================================

set -euo pipefail
cd "$(dirname "$0")"

env_get() { grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"; }
DB_HOST=$(env_get POSTGRES_HOST); DB_HOST=${DB_HOST:-host.docker.internal}
DB_PORT=$(env_get POSTGRES_PORT); DB_PORT=${DB_PORT:-5434}
DB_NAME=$(env_get POSTGRES_DB)
DB_USER=$(env_get POSTGRES_USER)
export PGPASSWORD; PGPASSWORD=$(env_get POSTGRES_PASSWORD)

DIR=${1:-./backups}
KEEP=14
mkdir -p "$DIR"
FILE="$DIR/${DB_NAME}-$(date +%Y%m%d-%H%M%S).dump"

docker run --rm -e PGPASSWORD --add-host host.docker.internal:host-gateway postgres:18-alpine \
  pg_dump -Fc -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$FILE.part"
mv "$FILE.part" "$FILE"
echo "$(date '+%F %T') backup: $FILE ($(du -h "$FILE" | cut -f1))"

# keep only the newest $KEEP backups
ls -1t "$DIR"/"${DB_NAME}"-*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
