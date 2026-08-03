/**
 * PATCH  /api/workspaces/:id/members/:userId -> change role { role } (admin+)
 * DELETE /api/workspaces/:id/members/:userId -> remove member (admin+, or self)
 * The last owner can neither be demoted nor removed.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth";
import { changeRole, getRole, removeMember, roleAtLeast } from "@/lib/workspace";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

interface Params {
  params: { id: string; userId: string };
}

export async function OPTIONS() {
  return preflight();
}

const roleSchema = z.object({ role: z.enum(["viewer", "editor", "admin", "owner"]) });

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);
  const role = await getRole(user.id, params.id);
  if (!roleAtLeast(role, "admin")) return error("Only admins can change roles", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body", 400);
  }
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) return error("Invalid role", 422);
  if (parsed.data.role === "owner" && role !== "owner") {
    return error("Only an owner can grant the owner role.", 403);
  }
  const ok = await changeRole(params.id, params.userId, parsed.data.role);
  if (!ok) return error("Can't demote the last owner.", 409);
  return json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);
  const role = await getRole(user.id, params.id);
  // Admins can remove anyone; members can remove themselves (leave).
  const isSelf = user.id === params.userId;
  if (!roleAtLeast(role, "admin") && !isSelf) return error("Forbidden", 403);
  const ok = await removeMember(params.id, params.userId);
  if (!ok) return error("Can't remove the last owner.", 409);
  return json({ ok: true });
}
