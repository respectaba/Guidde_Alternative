/**
 * S3-compatible storage driver (AWS S3, Cloudflare R2, MinIO, …). Enabled with
 * STORAGE_DRIVER=s3. The AWS SDK is an optional dependency, imported lazily so
 * the default (local) install stays lean — run `npm i @aws-sdk/client-s3` to use
 * this driver.
 *
 * Config (env):
 *   S3_BUCKET     (required)   bucket name
 *   S3_REGION     (default us-east-1)
 *   S3_ENDPOINT   (optional)   custom endpoint for R2/MinIO
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   standard credentials
 *
 * Objects are keyed `kind/guideId/filename`. Media is served through the app's
 * /api/media route (via read()), so the bucket can stay private.
 */
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type MediaKind, type StorageAdapter, mediaUrl } from "./types";

// Minimal shape of what we use from @aws-sdk/client-s3 (typed loosely to avoid a
// hard dependency on the package's types when it isn't installed).
interface S3ClientLike {
  send(cmd: unknown): Promise<{ Body?: unknown }>;
}

function key(kind: MediaKind, guideId: string, filename: string): string {
  return `${kind}/${guideId}/${filename}`;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  // Node stream (SDK v3 in Node returns a Readable).
  const chunks: Buffer[] = [];
  const stream = body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export class S3Storage implements StorageAdapter {
  private clientP: Promise<{ client: S3ClientLike; cmds: any }> | null = null;
  private bucket = process.env.S3_BUCKET ?? "";

  private async sdk() {
    if (!this.bucket) throw new Error("S3_BUCKET is not set");
    if (!this.clientP) {
      this.clientP = (async () => {
        let mod: any;
        try {
          // Variable specifier so bundlers don't try to resolve the optional dep
          // at build time; it's only needed when STORAGE_DRIVER=s3.
          const pkg = ["@aws-sdk", "client-s3"].join("/");
          mod = await import(/* webpackIgnore: true */ pkg);
        } catch {
          throw new Error(
            "STORAGE_DRIVER=s3 requires @aws-sdk/client-s3. Run: npm i @aws-sdk/client-s3",
          );
        }
        const { S3Client, PutObjectCommand, GetObjectCommand } = mod;
        const client: S3ClientLike = new S3Client({
          region: process.env.S3_REGION || "us-east-1",
          endpoint: process.env.S3_ENDPOINT || undefined,
          forcePathStyle: !!process.env.S3_ENDPOINT,
        });
        return { client, cmds: { PutObjectCommand, GetObjectCommand } };
      })();
    }
    return this.clientP;
  }

  async save(kind: MediaKind, guideId: string, filename: string, data: Buffer): Promise<string> {
    const { client, cmds } = await this.sdk();
    await client.send(
      new cmds.PutObjectCommand({ Bucket: this.bucket, Key: key(kind, guideId, filename), Body: data }),
    );
    return mediaUrl(kind, guideId, filename);
  }

  async read(kind: MediaKind, guideId: string, filename: string): Promise<Buffer | null> {
    const { client, cmds } = await this.sdk();
    try {
      const res = await client.send(
        new cmds.GetObjectCommand({ Bucket: this.bucket, Key: key(kind, guideId, filename) }),
      );
      if (!res.Body) return null;
      return await streamToBuffer(res.Body);
    } catch {
      return null;
    }
  }

  async toLocalPath(kind: MediaKind, guideId: string, filename: string): Promise<string | null> {
    const buf = await this.read(kind, guideId, filename);
    if (!buf) return null;
    const dir = await mkdtemp(join(tmpdir(), "s3media-"));
    const p = join(dir, filename);
    await writeFile(p, buf);
    return p;
  }
}
