/**
 * Storage facade. Selects the driver from STORAGE_DRIVER (default "local") and
 * exposes a small API used across the app. Guides always reference media by the
 * stable /api/media URL, so the backend can change without rewriting data.
 */
import { type MediaKind, type StorageAdapter } from "./types";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";

export type { MediaKind, StorageAdapter } from "./types";
export { mediaUrl } from "./types";

let adapter: StorageAdapter | null = null;

export function storage(): StorageAdapter {
  if (!adapter) {
    const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
    adapter = driver === "s3" ? new S3Storage() : new LocalStorage();
  }
  return adapter;
}

export function saveMedia(
  kind: MediaKind,
  guideId: string,
  filename: string,
  data: Buffer,
): Promise<string> {
  return storage().save(kind, guideId, filename, data);
}

export function readMedia(
  kind: MediaKind,
  guideId: string,
  filename: string,
): Promise<Buffer | null> {
  return storage().read(kind, guideId, filename);
}

export function mediaLocalPath(
  kind: MediaKind,
  guideId: string,
  filename: string,
): Promise<string | null> {
  return storage().toLocalPath(kind, guideId, filename);
}
