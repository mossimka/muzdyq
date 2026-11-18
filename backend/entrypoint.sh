#!/bin/sh
set -e

echo "Muzdyq backend starting (environment: ${ENVIRONMENT:-development})"

# Compose waits for the database healthcheck, but migrations can still race a
# slow Postgres start. Retry a few times with a clear error.
attempt=1
while [ "$attempt" -le 30 ]; do
  if alembic upgrade head; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "Database migrations failed after 30 attempts" >&2
    exit 1
  fi
  echo "Database not ready (attempt $attempt/30), retrying in 2s..."
  attempt=$((attempt + 1))
  sleep 2
done

# Idempotent: points are upserted, demo images are only generated when missing.
if [ "${SEED_ON_STARTUP:-true}" = "true" ]; then
  python -m app.seed
fi

exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers "${UVICORN_WORKERS:-1}" \
  --proxy-headers
