#!/bin/sh
# docker-entrypoint.sh — sync the database schema, then start the server.
#
# Runs on every container start. `prisma db push` is idempotent: it brings the
# database in sync with schema.prisma and is a no-op when already in sync, so
# repeated starts are safe. No seed data is inserted (clean database by design;
# create the first admin via the app / your own seed).
set -e

echo "[entrypoint] Syncing database schema (prisma db push)..."

ATTEMPTS=0
MAX_ATTEMPTS=30
until npx prisma db push --skip-generate; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "[entrypoint] ERROR: prisma db push failed after ${MAX_ATTEMPTS} attempts (is the database reachable?)" >&2
    exit 1
  fi
  echo "[entrypoint] database not ready (attempt ${ATTEMPTS}/${MAX_ATTEMPTS}) — retrying in 2s..."
  sleep 2
done

echo "[entrypoint] Schema in sync. Starting server on port ${PORT:-3456}..."
exec node server.js
