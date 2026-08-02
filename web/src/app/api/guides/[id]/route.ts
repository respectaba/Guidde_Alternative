/**
 * Single-guide endpoint — all operations require the authenticated owner.
 *   GET    /api/guides/:id  -> full guide (editor load)
 *   PATCH  /api/guides/:id  -> update title / isPublic / steps (editor save)
 *   DELETE /api/guides/:id  -> remove guide
 */
import type { NextRequest } from "next/server";
import { updateGuideSchema } from "@guide/shared";
import { deleteGuide, getGuide, updateGuide } from "@/lib/guides";
import { authenticateRequest } from "@/lib/auth";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

interface Params {
  params: { id: string };
}

export async function OPTIONS() {
  return preflight();
}

/** Load the guide and confirm the requester owns it. */
async function ownedGuide(req: NextRequest, id: string) {
  const user = await authenticateRequest(req);
  if (!user) return { err: error("Not authenticated", 401) };
  const guide = await getGuide(id);
  if (!guide) return { err: error("Guide not found", 404) };
  if (guide.userId !== user.id) return { err: error("Forbidden", 403) };
  return { user, guide };
}

export async function GET(req: NextRequest, { params }: Params) {
  const r = await ownedGuide(req, params.id);
  if (r.err) return r.err;
  return json({ guide: r.guide });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const r = await ownedGuide(req, params.id);
  if (r.err) return r.err;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body", 400);
  }

  const parsed = updateGuideSchema.safeParse(body);
  if (!parsed.success) {
    return error("Validation failed", 422, parsed.error.flatten());
  }

  const guide = await updateGuide(params.id, parsed.data);
  return json({ guide });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const r = await ownedGuide(req, params.id);
  if (r.err) return r.err;
  await deleteGuide(params.id);
  return json({ ok: true });
}
