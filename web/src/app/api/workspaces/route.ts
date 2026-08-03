/**
 * GET  /api/workspaces -> the caller's workspaces (with role) + active id
 * POST /api/workspaces -> create a new shared workspace { name }; caller = owner
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth";
import {
  createWorkspace,
  getActiveWorkspaceId,
  listWorkspaces,
} from "@/lib/workspace";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);
  const [workspaces, activeId] = await Promise.all([
    listWorkspaces(user.id),
    getActiveWorkspaceId(user.id, user.email),
  ]);
  return json({ workspaces, activeId });
}

const createSchema = z.object({ name: z.string().min(1).max(80) });

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body", 400);
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return error("Enter a workspace name (1–80 chars).", 422);
  const ws = await createWorkspace(user.id, parsed.data.name);
  return json({ workspace: { id: ws.id, name: ws.name, personal: false, role: "owner" } }, { status: 201 });
}
