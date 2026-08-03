/**
 * GET /api/media/:kind/:guideId/:file — serves generated audio/video through the
 * active storage adapter (local disk or S3). Path segments are validated to
 * prevent traversal.
 */
import { readMedia, type MediaKind } from "@/lib/storage";

export const dynamic = "force-dynamic";

const SAFE = /^[A-Za-z0-9._-]+$/;
const MIME: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  mp4: "video/mp4",
};

interface Params {
  params: { kind: string; guideId: string; file: string };
}

export async function GET(_req: Request, { params }: Params) {
  const { kind, guideId, file } = params;
  if ((kind !== "audio" && kind !== "video") || !SAFE.test(guideId) || !SAFE.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  const buf = await readMedia(kind as MediaKind, guideId, file);
  if (!buf) return new Response("Not found", { status: 404 });

  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  const body = new Uint8Array(buf);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
    },
  });
}
