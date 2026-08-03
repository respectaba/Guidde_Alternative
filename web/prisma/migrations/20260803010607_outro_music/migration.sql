-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Guide" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "showCover" BOOLEAN NOT NULL DEFAULT true,
    "showOutro" BOOLEAN NOT NULL DEFAULT true,
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    "musicUrl" TEXT,
    "publicSlug" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "steps" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Guide_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Guide" ("createdAt", "id", "isPublic", "publicSlug", "showCover", "steps", "subtitle", "title", "updatedAt", "userId") SELECT "createdAt", "id", "isPublic", "publicSlug", "showCover", "steps", "subtitle", "title", "updatedAt", "userId" FROM "Guide";
DROP TABLE "Guide";
ALTER TABLE "new_Guide" RENAME TO "Guide";
CREATE UNIQUE INDEX "Guide_publicSlug_key" ON "Guide"("publicSlug");
CREATE INDEX "Guide_updatedAt_idx" ON "Guide"("updatedAt");
CREATE INDEX "Guide_userId_idx" ON "Guide"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
