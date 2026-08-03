/**
 * Local-disk storage driver (default). Writes to a writable `.media/` dir and
 * serves via /api/media/*. We don't use public/ because `next start` only serves
 * assets present at build time. In production, prefer the S3 driver for
 * durability across restarts and instances.
 */
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { type MediaKind, type StorageAdapter, mediaUrl } from "./types";

function root(): string {
  return join(process.cwd(), ".media");
}

export function localDir(kind: MediaKind, guideId: string): string {
  return join(root(), kind, guideId);
}

export class LocalStorage implements StorageAdapter {
  async save(kind: MediaKind, guideId: string, filename: string, data: Buffer): Promise<string> {
    const dir = localDir(kind, guideId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), data);
    return mediaUrl(kind, guideId, filename);
  }

  async read(kind: MediaKind, guideId: string, filename: string): Promise<Buffer | null> {
    try {
      return await readFile(join(localDir(kind, guideId), filename));
    } catch {
      return null;
    }
  }

  async toLocalPath(kind: MediaKind, guideId: string, filename: string): Promise<string | null> {
    const p = join(localDir(kind, guideId), filename);
    try {
      await access(p);
      return p;
    } catch {
      return null;
    }
  }
}
