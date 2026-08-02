/**
 * Persists generated media (narration audio, exported video) to a writable
 * `.media/` dir and serves it via /api/media/*. We don't use public/ because
 * `next start` only serves public assets present at build time; an API route
 * reads the file at request time and works in dev and production alike.
 * (In real production this would be object storage.)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type MediaKind = "audio" | "video";

export function mediaRoot(): string {
  return join(process.cwd(), ".media");
}

export function mediaDir(kind: MediaKind, guideId: string): string {
  return join(mediaRoot(), kind, guideId);
}

export async function saveMedia(
  kind: MediaKind,
  guideId: string,
  filename: string,
  data: Buffer,
): Promise<string> {
  const dir = mediaDir(kind, guideId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), data);
  return `/api/media/${kind}/${guideId}/${filename}`;
}
