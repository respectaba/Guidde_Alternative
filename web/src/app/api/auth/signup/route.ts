import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { error, json } from "@/lib/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return error("Enter a valid email and a password of at least 8 characters.", 422);
  }
  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return error("An account with that email already exists.", 409);

  const user = await prisma.user.create({
    data: { email, passwordHash: hashPassword(parsed.data.password) },
  });
  setSessionCookie(user.id);
  return json({ ok: true, email: user.email }, { status: 201 });
}
