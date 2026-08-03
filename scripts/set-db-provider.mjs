/**
 * Sets the Prisma datasource provider in web/prisma/schema.prisma from the
 * DATABASE_PROVIDER env var (default "sqlite"). Prisma pins the provider in the
 * schema (it can't be an env() value), so switching to Postgres for production
 * means rewriting that one line before `prisma generate` / `db push`.
 *
 *   DATABASE_PROVIDER=postgresql node scripts/set-db-provider.mjs
 *
 * Idempotent; run it in the Docker build (see Dockerfile) or locally.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ALLOWED = new Set(["sqlite", "postgresql", "mysql"]);
const provider = (process.env.DATABASE_PROVIDER || "sqlite").toLowerCase();
if (!ALLOWED.has(provider)) {
  console.error(`Unsupported DATABASE_PROVIDER "${provider}". Use one of: ${[...ALLOWED].join(", ")}`);
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "..", "web", "prisma", "schema.prisma");

const src = readFileSync(schemaPath, "utf8");
const next = src.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]*"/s,
  `$1"${provider}"`,
);
if (next === src) {
  console.log(`Prisma provider already "${provider}".`);
} else {
  writeFileSync(schemaPath, next);
  console.log(`Set Prisma datasource provider to "${provider}".`);
}
