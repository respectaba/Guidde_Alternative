/**
 * Single-guide endpoint.
 *   GET    /api/guides/:id  -> full guide (editor load)
 *   PATCH  /api/guides/:id  -> update title / isPublic / steps (editor save)
 *   DELETE /api/guides/:id  -> remove guide
 */
import type { NextRequest } from "next/server";
import { updateGuideSchema } from "@guide/shared";
import { deleteGuide, getGuide, updateGuide } from "@/lib/guides";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

interface Params {
  params: { id: string };
}

export async function OPTIONS() {
  return preflight();
}

export async function GET(_req: NextRequest, { params }: Params) {
  const guide = await getGuide(params.id);
  if (!guide) return error("Guide not found", 404);
  return json({ guide });
}

export async function PATCH(req: NextRequest, { params }: Params) {
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
  if (!guide) return error("Guide not found", 404);
  return json({ guide });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const ok = await deleteGuide(params.id);
  if (!ok) return error("Guide not found", 404);
  return json({ ok: true });
}
