-- CreateTable
CREATE TABLE "TtsSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "voice" TEXT,
    "model" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TtsSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TtsSetting_userId_key" ON "TtsSetting"("userId");
