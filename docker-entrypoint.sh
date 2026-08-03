#!/bin/sh
# Create/upgrade the database schema, then start the server (or the given CMD).
# Safe to run on every boot.
#
# - SQLite (default): apply the committed migrations with `migrate deploy`.
# - Postgres/MySQL: this repo ships SQLite-flavored migrations, so we use
#   `db push` to create the schema directly from the Prisma models (the schema's
#   provider was set at build time via scripts/set-db-provider.mjs).
set -e

SCHEMA="web/prisma/schema.prisma"

if [ -n "$DATABASE_URL" ]; then
  case "$DATABASE_URL" in
    postgres*|postgresql*|mysql*)
      echo "Provisioning schema with prisma db push (non-SQLite provider)…"
      npx prisma db push --schema "$SCHEMA" --skip-generate || {
        echo "db push failed; continuing to start the server" >&2
      }
      ;;
    *)
      echo "Applying database migrations (SQLite)…"
      npx prisma migrate deploy --schema "$SCHEMA" || {
        echo "migrate deploy failed; continuing to start the server" >&2
      }
      ;;
  esac
fi

exec "$@"
