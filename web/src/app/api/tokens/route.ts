/**
 * Personal API tokens for the Chrome extension.
 *   GET  /api/tokens -> list the user's tokens (metadata only)
 *   POST /api/tokens -> create a token; plaintext is returned ONCE
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateApiToken, getSessionUser } from "@/lib/auth";
import { error, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return error("Not authenticated", 401);
  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
  });
  return json({ tokens });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return error("Not authenticated", 401);

  const body = await req.json().catch(() => ({}));
  const name = z.string().min(1).max(60).safeParse((body as { name?: string }).name);
  const label = name.success ? name.data : "Extension token";

  const { plaintext, hash, prefix } = generateApiToken();
  await prisma.apiToken.create({
    data: { userId: user.id, name: label, tokenHash: hash, prefix },
  });
  // Plaintext shown once; only the hash is stored.
  return json({ token: plaintext, name: label }, { status: 201 });
}
