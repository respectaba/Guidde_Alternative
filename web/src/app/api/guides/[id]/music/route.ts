/**
 * POST   /api/guides/:id/music — upload a background-music track (owner).
 * DELETE /api/guides/:id/music — remove it.
 * Stored under .media and referenced by guide.musicUrl; mixed into video export
 * and looped under playback.
 */
import type { NextRequest } from "next/server";
import { getGuide, updateGuide } from "@/lib/guides";
import { authenticateRequest } from "@/lib/auth";
import { canAccessGuide } from "@/lib/workspace";
import { saveMedia } from "@/lib/storage";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
};
const MAX_BYTES = 20 * 1024 * 1024;

export async function OPTIONS() {
  return preflight();
}

async function owned(req: NextRequest, id: string) {
  const user = await authenticateRequest(req);
  if (!user) return { err: error("Not authenticated", 401) };
  const guide = await getGuide(id);
  if (!guide) return { err: error("Guide not found", 404) };
  if (!(await canAccessGuide(user.id, guide, "editor"))) return { err: error("Forbidden", 403) };
  return { user, guide };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await owned(req, params.id);
  if (r.err) return r.err;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error("Expected multipart form-data with a 'file' field", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return error("No file uploaded", 400);
  const ext = EXT[file.type];
  if (!ext) return error(`Unsupported audio type: ${file.type || "unknown"}`, 415);
  if (file.size > MAX_BYTES) return error("File too large (max 20MB)", 413);

  const buf = Buffer.from(await file.arrayBuffer());
  const url = await saveMedia("audio", params.id, `bg.${ext}`, buf);
  const musicUrl = `${url}?v=${Date.now()}`;
  await updateGuide(params.id, { musicUrl });
  return json({ musicUrl });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await owned(req, params.id);
  if (r.err) return r.err;
  await updateGuide(params.id, { musicUrl: null });
  return json({ ok: true });
}
