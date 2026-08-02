/**
 * GET /api/media/:kind/:guideId/:file — streams generated audio/video from the
 * writable .media dir. Path segments are validated to prevent traversal.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { Readable } from "node:stream";
import { mediaDir, type MediaKind } from "@/lib/media/store";

export const dynamic = "force-dynamic";

const SAFE = /^[A-Za-z0-9._-]+$/;
const MIME: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
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
  const path = join(mediaDir(kind as MediaKind, guideId), file);
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  const nodeStream = createReadStream(path);
  const body = Readable.toWeb(nodeStream) as unknown as NodeReadableStream;
  return new Response(body as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(size),
      "Cache-Control": "no-store",
    },
  });
}
