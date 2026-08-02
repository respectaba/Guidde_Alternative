/**
 * POST /api/guides/:id/narrate — pre-render narration audio for every step using
 * the configured server TTS engine, save each clip, set step.audioUrl, and
 * persist. Playback then plays the audio track instead of live Web Speech, and
 * the video exporter uses the same clips. 501 when only browser TTS is available.
 */
import type { NextRequest } from "next/server";
import { getGuide, updateGuide } from "@/lib/guides";
import { serverTtsAvailable, synthesize, ttsEngine } from "@/lib/ai/tts";
import { saveMedia } from "@/lib/media/store";
import { authenticateRequest } from "@/lib/auth";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function OPTIONS() {
  return preflight();
}

export async function GET() {
  // Lets the editor check whether server voiceover is possible.
  return json({ available: serverTtsAvailable(), engine: ttsEngine() });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);
  if (!serverTtsAvailable()) {
    return error(
      "Server voiceover is not configured. Set TTS_PROVIDER (openai | elevenlabs | espeak).",
      501,
    );
  }
  const guide = await getGuide(params.id);
  if (!guide) return error("Guide not found", 404);
  if (guide.userId !== user.id) return error("Forbidden", 403);

  try {
    const steps = await Promise.all(
      guide.steps.map(async (step) => {
        const { audio, ext } = await synthesize(step.caption);
        const url = await saveMedia("audio", guide.id, `${step.id}.${ext}`, audio);
        return { ...step, audioUrl: `${url}?v=${Date.now()}` };
      }),
    );
    const updated = await updateGuide(guide.id, { steps });
    return json({ guide: updated, engine: ttsEngine() });
  } catch (e) {
    return error(`Voiceover failed: ${(e as Error).message}`, 500);
  }
}
