#!/usr/bin/env bash
# ==============================================================================
# DIGITECHKH PDF Converter - create its database on the shared PostgreSQL (run once)
# ==============================================================================
# Creates the user + database named in .env (POSTGRES_USER / POSTGRES_DB / POSTGRES_PASSWORD)
# on the same PostgreSQL server BMS uses. BMS's own database is not touched.
# Safe to run again: it only creates what is missing and resets the password to the one in .env.
#
# Usage:  ./setup-database.sh
# It asks for an admin account of that PostgreSQL (one that may create users and databases,
# e.g. the "postgres" superuser or the account BMS was set up with).
# ==============================================================================

set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "ERROR: deploy/.env not found. Run: cp .env.example .env  and fill it in."; exit 1; }

# read one value from .env (no 'source': values may contain spaces)
env_get() { grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"; }

DB_HOST=$(env_get POSTGRES_HOST); DB_HOST=${DB_HOST:-host.docker.internal}
DB_PORT=$(env_get POSTGRES_PORT); DB_PORT=${DB_PORT:-5434}
DB_NAME=$(env_get POSTGRES_DB)
DB_USER=$(env_get POSTGRES_USER)
DB_PASS=$(env_get POSTGRES_PASSWORD)

for v in DB_NAME DB_USER DB_PASS; do
  [ -n "${!v}" ] || { echo "ERROR: POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD must be set in .env"; exit 1; }
done
[ "$DB_PASS" != "change-me" ] || { echo "ERROR: change POSTGRES_PASSWORD in .env first (openssl rand -hex 24)"; exit 1; }
[[ "$DB_PASS" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "ERROR: POSTGRES_PASSWORD may contain only letters, digits, - and _ (it is used inside a URL)"; exit 1; }
[[ "$DB_NAME" =~ ^[a-z_][a-z0-9_]*$ && "$DB_USER" =~ ^[a-z_][a-z0-9_]*$ ]] || { echo "ERROR: POSTGRES_DB / POSTGRES_USER: lowercase letters, digits and _ only"; exit 1; }

echo "Shared PostgreSQL: $DB_HOST:$DB_PORT"
read -rp  "PostgreSQL admin user [postgres]: " PG_ADMIN; PG_ADMIN=${PG_ADMIN:-postgres}
read -rsp "Password for $PG_ADMIN: " PGPASSWORD; echo
export PGPASSWORD

# psql from a throwaway container: nothing to install on the server
psql_admin() {
  docker run --rm -i -e PGPASSWORD --add-host host.docker.internal:host-gateway postgres:18-alpine \
    psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$PG_ADMIN" -d postgres "$@"
}

echo "==> Creating user '$DB_USER' and database '$DB_NAME' (if missing)..."
psql_admin -q <<SQL
SELECT format('CREATE ROLE %I LOGIN', '$DB_USER') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER')\gexec
ALTER ROLE "$DB_USER" WITH LOGIN PASSWORD '$DB_PASS';
SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8'' TEMPLATE template0', '$DB_NAME', '$DB_USER')
  WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$DB_NAME')\gexec
ALTER DATABASE "$DB_NAME" OWNER TO "$DB_USER";
-- only its owner (and admins) may connect; the BMS users cannot open it
REVOKE CONNECT ON DATABASE "$DB_NAME" FROM PUBLIC;
SQL

echo "==> Checking that '$DB_USER' can sign in..."
PGPASSWORD="$DB_PASS" docker run --rm -e PGPASSWORD --add-host host.docker.internal:host-gateway postgres:18-alpine \
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "select 'ok: connected to ' || current_database() || ' as ' || current_user"

unset PGPASSWORD
echo "Done. Next: ./rebuild.sh"
