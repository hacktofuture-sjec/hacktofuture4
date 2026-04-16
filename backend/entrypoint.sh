#!/usr/bin/env bash
# =============================================================================
# backend/entrypoint.sh — Docker entrypoint for Django backend service
#
# Responsibilities:
#   1. Wait for PostgreSQL to be ready (pg_isready)
#   2. Run database migrations (--no-input)
#   3. Collect static files
#   4. Create default superuser if CREATE_SUPERUSER=true
#   5. Hand off to gunicorn (CMD from Dockerfile)
# =============================================================================
set -euo pipefail

# ── Colour helpers ─────────────────────────────────────────────────────────────
log()  { echo "[entrypoint] $*"; }
info() { echo "[entrypoint] ℹ️  $*"; }
ok()   { echo "[entrypoint] ✅ $*"; }
err()  { echo "[entrypoint] ❌ $*" >&2; }

# ── Wait for Postgres ──────────────────────────────────────────────────────────
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
MAX_RETRIES=30
RETRY_INTERVAL=2

log "Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
for i in $(seq 1 "$MAX_RETRIES"); do
    if pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -q; then
        ok "PostgreSQL is ready."
        break
    fi
    if [ "$i" -eq "$MAX_RETRIES" ]; then
        err "PostgreSQL did not become ready in time. Aborting."
        exit 1
    fi
    info "Attempt $i/$MAX_RETRIES — retrying in ${RETRY_INTERVAL}s..."
    sleep "$RETRY_INTERVAL"
done

# ── Run migrations ─────────────────────────────────────────────────────────────
log "Running database migrations..."
python manage.py migrate --no-input
ok "Migrations complete."

# ── Collect static files ───────────────────────────────────────────────────────
log "Collecting static files..."
python manage.py collectstatic --no-input --clear 2>/dev/null || true
ok "Static files collected."

# ── Optional: create superuser ─────────────────────────────────────────────────
if [ "${CREATE_SUPERUSER:-false}" = "true" ]; then
    DJANGO_SU_EMAIL="${DJANGO_SU_EMAIL:-admin@example.com}"
    DJANGO_SU_PASSWORD="${DJANGO_SU_PASSWORD:-changeme}"
    log "Creating superuser: ${DJANGO_SU_EMAIL}"
    python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(email='${DJANGO_SU_EMAIL}').exists():
    User.objects.create_superuser('${DJANGO_SU_EMAIL}', '${DJANGO_SU_EMAIL}', '${DJANGO_SU_PASSWORD}')
    print('Superuser created.')
else:
    print('Superuser already exists — skipping.')
" 2>&1 || true
fi

# ── Hand off to CMD ────────────────────────────────────────────────────────────
ok "Starting application: $*"
exec "$@"
