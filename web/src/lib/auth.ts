/**
 * Authentication primitives (no external deps):
 * - password hashing via scrypt
 * - stateless session cookie signed with HMAC-SHA256
 * - personal API tokens (for the extension), stored as sha256 hashes
 * - request authentication accepting either the session cookie or a Bearer token
 */
import {
  createHmac,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "./db";

const SESSION_COOKIE = "gf_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
}

// ---- passwords ----
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ---- session cookie ----
function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload = `${userId}.${Date.now() + SESSION_TTL_MS}`;
  const b = Buffer.from(payload).toString("base64url");
  return `${b}.${sign(b)}`;
}

function verifySessionToken(token: string): string | null {
  const [b, sig] = token.split(".");
  if (!b || !sig) return null;
  const expected = sign(b);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const [userId, expiry] = Buffer.from(b, "base64url").toString().split(".");
  if (!userId || !expiry || Date.now() > Number(expiry)) return null;
  return userId;
}

export function setSessionCookie(userId: string) {
  cookies().set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}

export interface SessionUser {
  id: string;
  email: string;
}

/** Current user from the session cookie (server components + route handlers). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? { id: user.id, email: user.email } : null;
}

// ---- API tokens (extension) ----
export function generateApiToken(): { plaintext: string; hash: string; prefix: string } {
  const raw = randomBytes(24).toString("hex");
  const plaintext = `gf_${raw}`;
  return { plaintext, hash: sha256(plaintext), prefix: plaintext.slice(0, 8) };
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

async function userFromBearer(req: NextRequest): Promise<SessionUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return null;
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: sha256(m[1].trim()) },
    include: { user: true },
  });
  if (!token) return null;
  // best-effort last-used stamp
  prisma.apiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return { id: token.user.id, email: token.user.email };
}

/**
 * Authenticate an API request via the session cookie OR a Bearer API token.
 * The extension uses the token; the web app uses the cookie.
 */
export async function authenticateRequest(req: NextRequest): Promise<SessionUser | null> {
  return (await userFromBearer(req)) ?? (await getSessionUser());
}
