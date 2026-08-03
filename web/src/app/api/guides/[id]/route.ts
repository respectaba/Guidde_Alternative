/**
 * Single-guide endpoint — operations require a sufficient workspace role.
 *   GET    /api/guides/:id  -> full guide (editor load; viewer+)
 *   PATCH  /api/guides/:id  -> update title / isPublic / steps (editor+)
 *   DELETE /api/guides/:id  -> remove guide (editor+)
 */
import type { NextRequest } from "next/server";
import { updateGuideSchema } from "@guide/shared";
import { deleteGuide, getGuide, updateGuide } from "@/lib/guides";
import { authenticateRequest } from "@/lib/auth";
import { canAccessGuide, type Role } from "@/lib/workspace";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

interface Params {
  params: { id: string };
}

export async function OPTIONS() {
  return preflight();
}

/** Load the guide and confirm the requester holds at least `min` role on it. */
async function guardGuide(req: NextRequest, id: string, min: Role) {
  const user = await authenticateRequest(req);
  if (!user) return { err: error("Not authenticated", 401) };
  const guide = await getGuide(id);
  if (!guide) return { err: error("Guide not found", 404) };
  if (!(await canAccessGuide(user.id, guide, min))) return { err: error("Forbidden", 403) };
  return { user, guide };
}

export async function GET(req: NextRequest, { params }: Params) {
  const r = await guardGuide(req, params.id, "viewer");
  if (r.err) return r.err;
  return json({ guide: r.guide });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const r = await guardGuide(req, params.id, "editor");
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
  const r = await guardGuide(req, params.id, "editor");
  if (r.err) return r.err;
  await deleteGuide(params.id);
  return json({ ok: true });
}
