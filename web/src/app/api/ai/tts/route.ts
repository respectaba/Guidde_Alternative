/**
 * POST /api/ai/tts — synthesize a single piece of text to audio and return the
 * bytes, using the authenticated caller's resolved TTS config (BYO key / env /
 * espeak). 501 when only browser TTS is available. For per-step guide narration,
 * prefer POST /api/guides/:id/narrate.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveTtsConfig, serverTtsAvailable, synthesize } from "@/lib/ai/tts";
import { authenticateRequest } from "@/lib/auth";
import { error, preflight, CORS_HEADERS } from "@/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ text: z.string().min(1), voice: z.string().optional() });

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);

  const config = await resolveTtsConfig(user.id);
  if (!serverTtsAvailable(config)) {
    return error(
      "No voiceover engine available. Add your TTS key in Settings, or set TTS_PROVIDER.",
      501,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body", 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return error("Validation failed", 422, parsed.error.flatten());

  try {
    const { audio, mime } = await synthesize(parsed.data.text, {
      ...config,
      voice: parsed.data.voice ?? config.voice,
    });
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": mime, "Cache-Control": "no-store" },
    });
  } catch (e) {
    return error(`TTS failed: ${(e as Error).message}`, 500);
  }
}
