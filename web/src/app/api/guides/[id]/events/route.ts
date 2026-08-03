/**
 * POST /api/guides/:id/events — record a viewer event (view | complete) for a
 * PUBLIC guide. Unauthenticated (viewers aren't logged in); only public guides
 * are tracked. CORS-open so embeds on any origin can beacon.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordEvent } from "@/lib/analytics";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  type: z.enum(["view", "complete"]),
  source: z.enum(["public", "embed"]).default("public"),
});

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return error("Validation failed", 422, parsed.error.flatten());

  // Only track public guides; ignore silently otherwise.
  const guide = await prisma.guide.findUnique({
    where: { id: params.id },
    select: { isPublic: true },
  });
  if (!guide || !guide.isPublic) return json({ ok: false }, { status: 200 });

  await recordEvent(params.id, parsed.data.type, parsed.data.source);
  return json({ ok: true });
}
