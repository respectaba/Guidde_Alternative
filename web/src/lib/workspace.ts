/**
 * Team workspaces: membership, roles, the active-workspace cookie, and
 * guide-level authorization.
 *
 * Roles are ordered viewer < editor < admin < owner. Guides belong to a
 * workspace; a user may act on a guide only if they hold a sufficient role in
 * that workspace. Legacy guides created before workspaces (workspaceId null but
 * userId set) fall back to creator-only access and are adopted into the
 * creator's personal workspace on first access.
 */
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import type { Guide } from "@guide/shared";

export type Role = "viewer" | "editor" | "admin" | "owner";

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

export function roleAtLeast(role: Role | null | undefined, min: Role): boolean {
  return !!role && RANK[role] >= RANK[min];
}

export function isRole(v: string): v is Role {
  return v === "viewer" || v === "editor" || v === "admin" || v === "owner";
}

const WORKSPACE_COOKIE = "gf_workspace";

export interface WorkspaceSummary {
  id: string;
  name: string;
  personal: boolean;
  role: Role;
}

function personalName(email: string): string {
  const handle = email.split("@")[0] || "My";
  return `${handle}'s workspace`;
}

/**
 * Ensure the user has a personal workspace, creating it (and an owner
 * membership) if absent, and adopting any of their orphaned legacy guides
 * (userId set, workspaceId null) into it. Returns the personal workspace id.
 */
export async function ensurePersonalWorkspace(userId: string, email?: string): Promise<string> {
  const existing = await prisma.workspace.findFirst({
    where: { personal: true, memberships: { some: { userId, role: "owner" } } },
  });
  let workspaceId = existing?.id;
  if (!workspaceId) {
    const mail =
      email ?? (await prisma.user.findUnique({ where: { id: userId } }))?.email ?? "my";
    const ws = await prisma.workspace.create({
      data: {
        name: personalName(mail),
        personal: true,
        memberships: { create: { userId, role: "owner" } },
      },
    });
    workspaceId = ws.id;
  }
  // Adopt any orphaned legacy guides created by this user.
  await prisma.guide.updateMany({
    where: { userId, workspaceId: null },
    data: { workspaceId },
  });
  return workspaceId;
}

/** All workspaces the user belongs to, with their role, personal first. */
export async function listWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  await ensurePersonalWorkspace(userId);
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships
    .map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      personal: m.workspace.personal,
      role: (isRole(m.role) ? m.role : "editor") as Role,
    }))
    .sort((a, b) => Number(b.personal) - Number(a.personal));
}

/** The caller's role in a workspace, or null if they're not a member. */
export async function getRole(userId: string, workspaceId: string): Promise<Role | null> {
  const m = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!m) return null;
  return isRole(m.role) ? m.role : "editor";
}

/**
 * The active workspace for this request: the cookie value if the user is still
 * a member, otherwise their personal workspace. Always returns a workspace the
 * user can access.
 */
export async function getActiveWorkspaceId(userId: string, email?: string): Promise<string> {
  const personal = await ensurePersonalWorkspace(userId, email);
  const cookie = cookies().get(WORKSPACE_COOKIE)?.value;
  if (cookie && cookie !== personal) {
    const role = await getRole(userId, cookie);
    if (role) return cookie;
  }
  return personal;
}

export function setActiveWorkspaceCookie(workspaceId: string) {
  cookies().set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/**
 * Authorize a guide action. Returns the caller's effective role on the guide,
 * or null if they may not access it at the requested level. Handles both
 * workspace-owned guides and legacy creator-owned guides.
 */
export async function guideRole(userId: string, guide: Guide): Promise<Role | null> {
  if (guide.workspaceId) return getRole(userId, guide.workspaceId);
  // Legacy guide with no workspace yet: only its creator has access (as owner).
  if (guide.userId && guide.userId === userId) return "owner";
  return null;
}

/** True when the caller may act on the guide at (at least) the given role. */
export async function canAccessGuide(
  userId: string,
  guide: Guide,
  min: Role,
): Promise<boolean> {
  return roleAtLeast(await guideRole(userId, guide), min);
}

// ---- workspace administration ----

/** Create a new shared workspace with the caller as owner. */
export async function createWorkspace(userId: string, name: string) {
  return prisma.workspace.create({
    data: {
      name: name.trim() || "New workspace",
      personal: false,
      memberships: { create: { userId, role: "owner" } },
    },
  });
}

export interface MemberRow {
  userId: string;
  email: string;
  role: Role;
  self: boolean;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  token: string;
  createdAt: string;
}

/** Members and pending invites for a workspace. */
export async function listMembers(
  workspaceId: string,
  selfId: string,
): Promise<{ members: MemberRow[]; invites: PendingInvite[] }> {
  const memberships = await prisma.membership.findMany({
    where: { workspaceId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  const invites = await prisma.invite.findMany({
    where: { workspaceId, acceptedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return {
    members: memberships.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      role: (isRole(m.role) ? m.role : "editor") as Role,
      self: m.userId === selfId,
    })),
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: (isRole(i.role) ? i.role : "editor") as Role,
      token: i.token,
      createdAt: i.createdAt.toISOString(),
    })),
  };
}

export type InviteResult =
  | { kind: "added"; email: string }
  | { kind: "invited"; email: string; token: string };

/**
 * Invite someone to a workspace by email. If they already have an account they
 * are added directly; otherwise a tokenized invite is created (redeem at
 * /invite/:token). Idempotent for existing members.
 */
export async function inviteMember(
  workspaceId: string,
  invitedById: string,
  email: string,
  role: Role,
): Promise<InviteResult> {
  const normalized = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (user) {
    await prisma.membership.upsert({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
      update: { role },
      create: { workspaceId, userId: user.id, role },
    });
    return { kind: "added", email: normalized };
  }
  const token = randomBytes(24).toString("base64url");
  await prisma.invite.create({
    data: { workspaceId, email: normalized, role, token, invitedById },
  });
  return { kind: "invited", email: normalized, token };
}

/** Change a member's role. Refuses to demote the last owner. */
export async function changeRole(workspaceId: string, userId: string, role: Role): Promise<boolean> {
  if (role !== "owner") {
    const owners = await prisma.membership.count({ where: { workspaceId, role: "owner" } });
    const target = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (target?.role === "owner" && owners <= 1) return false;
  }
  await prisma.membership.update({
    where: { workspaceId_userId: { workspaceId, userId } },
    data: { role },
  });
  return true;
}

/** Remove a member. Refuses to remove the last owner. */
export async function removeMember(workspaceId: string, userId: string): Promise<boolean> {
  const target = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!target) return false;
  if (target.role === "owner") {
    const owners = await prisma.membership.count({ where: { workspaceId, role: "owner" } });
    if (owners <= 1) return false;
  }
  await prisma.membership.delete({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  return true;
}

/** Redeem an invite token for the signed-in user. */
export async function acceptInvite(token: string, userId: string): Promise<string | null> {
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt) return null;
  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
    update: { role: invite.role },
    create: { workspaceId: invite.workspaceId, userId, role: invite.role },
  });
  await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  return invite.workspaceId;
}
