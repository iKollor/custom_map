#!/usr/bin/env bash
# Applies SQL migrations idempotently, then starts the Next.js server.
# All migration files must use IF NOT EXISTS / IF EXISTS guards so that
# re-running them is safe.
set -euo pipefail

MIGRATIONS_DIR="/app/apps/web/prisma/migrations"

if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "[entrypoint] DATABASE_URL is not set; skipping migrations." >&2
else
    echo "[entrypoint] Waiting for database to accept connections..."
    # Retry up to ~60 seconds
    for i in $(seq 1 30); do
        if psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
            echo "[entrypoint] Database is ready."
            break
        fi
        if [[ "$i" -eq 30 ]]; then
            echo "[entrypoint] Database is not reachable after 60s; aborting." >&2
            exit 1
        fi
        sleep 2
    done

    if [[ -d "$MIGRATIONS_DIR" ]]; then
        # Apply .sql files in lexical order
        for sql in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
            echo "[entrypoint] Applying migration: $(basename "$sql")"
            psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$sql"
        done

        # Ensure base tables from the Prisma schema exist (idempotent).
        # prisma db push is safest when available; we rely on migrations here.
    else
        echo "[entrypoint] No migrations directory at $MIGRATIONS_DIR; skipping."
    fi
fi

echo "[entrypoint] Starting: $*"
exec "$@"
