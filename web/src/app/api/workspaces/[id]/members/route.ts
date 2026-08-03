/**
 * GET  /api/workspaces/:id/members -> members + pending invites (member only)
 * POST /api/workspaces/:id/members -> invite by email { email, role } (admin+)
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth";
import { getRole, inviteMember, listMembers, roleAtLeast } from "@/lib/workspace";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);
  const role = await getRole(user.id, params.id);
  if (!role) return error("Forbidden", 403);
  const data = await listMembers(params.id, user.id);
  return json({ ...data, role });
}

const inviteSchema = z.object({
  email: z.string().email().max(200),
  role: z.enum(["viewer", "editor", "admin", "owner"]).default("editor"),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);
  const role = await getRole(user.id, params.id);
  if (!roleAtLeast(role, "admin")) return error("Only admins can invite members", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body", 400);
  }
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return error("Enter a valid email and role.", 422);
  // Only an owner may grant the owner role.
  if (parsed.data.role === "owner" && role !== "owner") {
    return error("Only an owner can grant the owner role.", 403);
  }
  const result = await inviteMember(params.id, user.id, parsed.data.email, parsed.data.role);
  return json({ result }, { status: 201 });
}
