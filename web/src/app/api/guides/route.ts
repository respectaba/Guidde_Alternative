/**
 * Collection endpoint for guides.
 *   GET  /api/guides  -> list the signed-in user's guides (dashboard)
 *   POST /api/guides  -> create a guide (web session OR extension Bearer token)
 */
import type { NextRequest } from "next/server";
import { createGuideSchema } from "@guide/shared";
import { createGuide, listGuides } from "@/lib/guides";
import { authenticateRequest } from "@/lib/auth";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);
  const guides = await listGuides(user.id);
  return json({ guides });
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return error("Not authenticated. Sign in, or set an API token in the extension.", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body", 400);
  }

  const parsed = createGuideSchema.safeParse(body);
  if (!parsed.success) {
    return error("Validation failed", 422, parsed.error.flatten());
  }

  const guide = await createGuide(parsed.data, user.id);
  return json({ id: guide.id, publicSlug: guide.publicSlug, guide }, { status: 201 });
}
