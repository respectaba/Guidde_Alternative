/**
 * POST /api/guides/:id/video — render the guide to an MP4 (frames + zoom/pan +
 * narration via ffmpeg), store it, and return its URL. Synchronous; can take
 * tens of seconds for longer guides.
 */
import type { NextRequest } from "next/server";
import { getGuide } from "@/lib/guides";
import { exportGuideToVideo } from "@/lib/video/export";
import { saveMedia } from "@/lib/media/store";
import { authenticateRequest } from "@/lib/auth";
import { resolveTtsConfig } from "@/lib/ai/tts";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);
  const guide = await getGuide(params.id);
  if (!guide) return error("Guide not found", 404);
  if (guide.userId !== user.id) return error("Forbidden", 403);

  try {
    const tts = await resolveTtsConfig(user.id);
    const mp4 = await exportGuideToVideo(guide, tts);
    const url = await saveMedia("video", guide.id, `guide.mp4`, mp4);
    return json({ videoUrl: `${url}?v=${Date.now()}`, bytes: mp4.length });
  } catch (e) {
    return error(`Video export failed: ${(e as Error).message}`, 500);
  }
}
