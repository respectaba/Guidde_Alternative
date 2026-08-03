/**
 * POST /api/workspaces/active -> set the active workspace cookie { workspaceId }.
 * The caller must be a member of the target workspace.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth";
import { getRole, setActiveWorkspaceCookie } from "@/lib/workspace";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

const schema = z.object({ workspaceId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("workspaceId required", 422);
  const role = await getRole(user.id, parsed.data.workspaceId);
  if (!role) return error("Not a member of that workspace", 403);
  setActiveWorkspaceCookie(parsed.data.workspaceId);
  return json({ ok: true, activeId: parsed.data.workspaceId });
}
