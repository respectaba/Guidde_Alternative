/**
 * POST /api/guides/:id/narrate — pre-render narration audio for every step using
 * the owner's resolved TTS config (their BYO key, else the operator's env key,
 * else offline espeak), save each clip, set step.audioUrl, and persist.
 * 501 when only browser TTS is available. GET reports availability for the owner.
 */
import type { NextRequest } from "next/server";
import { getGuide, updateGuide } from "@/lib/guides";
import { resolveTtsConfig, serverTtsAvailable, synthesize } from "@/lib/ai/tts";
import { saveMedia } from "@/lib/media/store";
import { authenticateRequest } from "@/lib/auth";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function OPTIONS() {
  return preflight();
}

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);
  const config = await resolveTtsConfig(user.id);
  return json({ available: serverTtsAvailable(config), engine: config.engine });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);

  const guide = await getGuide(params.id);
  if (!guide) return error("Guide not found", 404);
  if (guide.userId !== user.id) return error("Forbidden", 403);

  const config = await resolveTtsConfig(user.id);
  if (!serverTtsAvailable(config)) {
    return error(
      "No voiceover engine available. Add your TTS key in Settings, or set TTS_PROVIDER.",
      501,
    );
  }

  try {
    const steps = await Promise.all(
      guide.steps.map(async (step) => {
        const { audio, ext } = await synthesize(step.caption, config);
        const url = await saveMedia("audio", guide.id, `${step.id}.${ext}`, audio);
        return { ...step, audioUrl: `${url}?v=${Date.now()}` };
      }),
    );
    const updated = await updateGuide(guide.id, { steps });
    return json({ guide: updated, engine: config.engine });
  } catch (e) {
    return error(`Voiceover failed: ${(e as Error).message}`, 500);
  }
}
