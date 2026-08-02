import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

/**
 * Creates a throwaway SQLite database for the test run by pushing the Prisma
 * schema, then removes it afterwards. Route-handler tests exercise the real
 * persistence layer against this DB.
 */
const TEST_DB = "file:./test.db";
const dbFile = path.resolve(__dirname, "prisma/test.db");

export function setup() {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: __dirname,
    env: { ...process.env, DATABASE_URL: TEST_DB },
    stdio: "ignore",
  });
}

export function teardown() {
  for (const suffix of ["", "-journal"]) {
    try {
      rmSync(dbFile + suffix);
    } catch {
      /* ignore */
    }
  }
}
