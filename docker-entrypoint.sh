#!/bin/sh
# Apply pending DB migrations, then start the server (or whatever CMD was given).
# Safe to run on every boot: `migrate deploy` only applies un-applied migrations.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations…"
  npx prisma migrate deploy --schema web/prisma/schema.prisma || {
    echo "migrate deploy failed; continuing to start the server" >&2
  }
fi

exec "$@"
