/**
 * GET  /api/invites/:token -> preview an invite (workspace name, role, status)
 * POST /api/invites/:token -> accept it as the signed-in user (sets it active)
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { acceptInvite, setActiveWorkspaceCookie } from "@/lib/workspace";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const invite = await prisma.invite.findUnique({
    where: { token: params.token },
    include: { workspace: true },
  });
  if (!invite) return error("Invite not found", 404);
  return json({
    email: invite.email,
    role: invite.role,
    workspaceName: invite.workspace.name,
    accepted: !!invite.acceptedAt,
  });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return error("Sign in to accept this invite.", 401);
  const workspaceId = await acceptInvite(params.token, user.id);
  if (!workspaceId) return error("This invite is invalid or already used.", 410);
  setActiveWorkspaceCookie(workspaceId);
  return json({ ok: true, workspaceId });
}
