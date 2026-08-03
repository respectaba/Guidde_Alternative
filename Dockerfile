# Multi-stage build for the Guideflow web app (Next.js standalone).
# Build context is the monorepo root so the shared workspace package is available.

# ---- deps: install all workspace dependencies ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY web/package.json web/
COPY extension/package.json extension/
RUN npm ci

# ---- builder: generate Prisma client + build Next standalone ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Datasource provider baked into the schema at build time (Prisma pins it there).
# Override with: docker build --build-arg DATABASE_PROVIDER=postgresql ...
ARG DATABASE_PROVIDER=sqlite
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma client is generated against the schema; DATABASE_URL is only needed at
# runtime, but a placeholder lets `prisma generate` run at build time.
ENV DATABASE_URL="file:./dev.db"
RUN node scripts/set-db-provider.mjs \
  && npx prisma generate --schema web/prisma/schema.prisma \
  && npm run build -w web

# ---- runner: minimal runtime image ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Fonts for server-side canvas text (cover/outro slides) rendered by @napi-rs/canvas.
RUN apt-get update \
  && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

# Next standalone server + static assets. Paths reflect the monorepo tracing root.
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./web/.next/static
COPY --from=builder /app/web/public ./web/public
# Prisma schema + migrations so the entrypoint can run `migrate deploy`.
COPY --from=builder /app/web/prisma ./web/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Writable media dir for the local storage driver (mount a volume in production,
# or set STORAGE_DRIVER=s3 to offload to object storage).
RUN mkdir -p /app/web/.media
VOLUME ["/app/web/.media"]

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "web/server.js"]
