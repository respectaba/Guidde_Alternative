/**
 * Per-tenant TTS settings (bring-your-own-key).
 *   GET    -> { provider, voice, model, hasKey }  (never returns the key)
 *   PUT    -> save provider + encrypted key (+ optional voice/model)
 *   DELETE -> remove the setting (fall back to server/env or offline)
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { error, json } from "@/lib/http";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  provider: z.enum(["openai", "elevenlabs"]),
  apiKey: z.string().min(8).max(400),
  voice: z.string().max(120).optional(),
  model: z.string().max(120).optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return error("Not authenticated", 401);
  const s = await prisma.ttsSetting.findUnique({ where: { userId: user.id } });
  return json({
    provider: s?.provider ?? null,
    voice: s?.voice ?? null,
    model: s?.model ?? null,
    hasKey: !!s,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return error("Not authenticated", 401);

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return error("Validation failed", 422, parsed.error.flatten());

  const { provider, apiKey, voice, model } = parsed.data;
  const data = {
    provider,
    apiKeyEnc: encryptSecret(apiKey),
    voice: voice || null,
    model: model || null,
  };
  await prisma.ttsSetting.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  return json({ ok: true, provider, hasKey: true });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return error("Not authenticated", 401);
  await prisma.ttsSetting.deleteMany({ where: { userId: user.id } });
  return json({ ok: true });
}
