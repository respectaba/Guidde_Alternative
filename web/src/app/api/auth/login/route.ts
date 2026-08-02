import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { error, json } from "@/lib/http";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Invalid credentials.", 401);

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return error("Invalid email or password.", 401);
  }
  setSessionCookie(user.id);
  return json({ ok: true, email: user.email });
}
