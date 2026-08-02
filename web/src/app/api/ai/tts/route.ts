/**
 * POST /api/ai/tts — synthesize a single piece of text to audio and return the
 * bytes. Engine is chosen by TTS_PROVIDER (openai | elevenlabs | espeak); with
 * TTS_PROVIDER=browser there's no server engine and playback narrates client-side.
 * For per-step guide narration, prefer POST /api/guides/:id/narrate.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { serverTtsAvailable, synthesize } from "@/lib/ai/tts";
import { error, preflight, CORS_HEADERS } from "@/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ text: z.string().min(1), voice: z.string().optional() });

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest) {
  if (!serverTtsAvailable()) {
    return error(
      "Server TTS is not configured. Playback uses the browser's Web Speech API by default.",
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
    const { audio, mime } = await synthesize(parsed.data.text, parsed.data.voice);
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": mime, "Cache-Control": "no-store" },
    });
  } catch (e) {
    return error(`TTS failed: ${(e as Error).message}`, 500);
  }
}
