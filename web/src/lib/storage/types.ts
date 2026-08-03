/** Media stored by the app: pre-rendered narration audio and exported video. */
export type MediaKind = "audio" | "video";

/**
 * A pluggable media store. Guides reference media by a stable app URL
 * (/api/media/:kind/:guideId/:file) which the media route resolves through the
 * active adapter, so switching backends never rewrites stored URLs.
 */
export interface StorageAdapter {
  /** Persist bytes and return the app-relative URL to serve them. */
  save(kind: MediaKind, guideId: string, filename: string, data: Buffer): Promise<string>;
  /** Read bytes back, or null if absent. */
  read(kind: MediaKind, guideId: string, filename: string): Promise<Buffer | null>;
  /**
   * A local filesystem path to the object (materializing it to a temp file for
   * remote backends), or null if absent. Used to feed ffmpeg during export.
   */
  toLocalPath(kind: MediaKind, guideId: string, filename: string): Promise<string | null>;
}

/** The app-relative URL used to reference a stored object. */
export function mediaUrl(kind: MediaKind, guideId: string, filename: string): string {
  return `/api/media/${kind}/${guideId}/${filename}`;
}
