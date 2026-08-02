/**
 * POST /api/ai/tts — optional server-side text-to-speech.
 *
 * By default (TTS_PROVIDER=browser) playback narrates client-side via the Web
 * Speech API and never calls this route. When TTS_PROVIDER=service, wire a real
 * TTS provider here (return audio bytes or a hosted URL) and have the editor
 * pre-render each step's `audioUrl`. This is the integration point; it responds
 * 501 until a service is configured so the contract is explicit.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().min(1),
  voice: z.string().optional(),
});

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest) {
  const provider = process.env.TTS_PROVIDER ?? "browser";
  if (provider !== "service" || !process.env.TTS_API_KEY) {
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
  if (!parsed.success) {
    return error("Validation failed", 422, parsed.error.flatten());
  }

  // Integration point: call your TTS provider with parsed.data.text here,
  // then return { audioUrl } (hosted) or stream audio bytes.
  return json(
    { error: "Not implemented: connect a TTS provider in web/src/app/api/ai/tts/route.ts" },
    { status: 501 },
  );
}
