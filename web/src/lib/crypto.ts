/**
 * Symmetric encryption for secrets at rest (per-tenant TTS API keys).
 * AES-256-GCM with a key derived from ENCRYPTION_KEY (falling back to
 * AUTH_SECRET) via scrypt. Ciphertext is `iv.tag.data`, all base64.
 *
 * NOTE: rotating ENCRYPTION_KEY/AUTH_SECRET invalidates previously stored
 * secrets (they can no longer be decrypted) — users would re-enter their key.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const SALT = "guideflow.secretbox.v1";

function key(): Buffer {
  const material = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
  return scryptSync(material, SALT, 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
