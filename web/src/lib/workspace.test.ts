import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Guide } from "@guide/shared";
import { prisma } from "@/lib/db";
import {
  acceptInvite,
  canAccessGuide,
  changeRole,
  createWorkspace,
  ensurePersonalWorkspace,
  getRole,
  guideRole,
  inviteMember,
  listWorkspaces,
  removeMember,
  roleAtLeast,
} from "@/lib/workspace";

async function mkUser(email: string) {
  return prisma.user.create({ data: { email, passwordHash: "x:y" } });
}

function fakeGuide(over: Partial<Guide>): Guide {
  return {
    id: "g",
    title: "G",
    publicSlug: "s",
    isPublic: false,
    steps: [],
    userId: null,
    workspaceId: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

beforeEach(async () => {
  await prisma.guide.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("role ordering", () => {
  it("ranks roles viewer < editor < admin < owner", () => {
    expect(roleAtLeast("owner", "admin")).toBe(true);
    expect(roleAtLeast("editor", "editor")).toBe(true);
    expect(roleAtLeast("viewer", "editor")).toBe(false);
    expect(roleAtLeast(null, "viewer")).toBe(false);
  });
});

describe("personal workspace", () => {
  it("creates one owner membership and is idempotent", async () => {
    const u = await mkUser("p@x.com");
    const a = await ensurePersonalWorkspace(u.id, u.email);
    const b = await ensurePersonalWorkspace(u.id, u.email);
    expect(a).toBe(b);
    expect(await getRole(u.id, a)).toBe("owner");
    const ws = await listWorkspaces(u.id);
    expect(ws).toHaveLength(1);
    expect(ws[0].personal).toBe(true);
  });

  it("adopts orphaned legacy guides into the personal workspace", async () => {
    const u = await mkUser("legacy@x.com");
    const g = await prisma.guide.create({
      data: { title: "Old", publicSlug: "old", steps: "[]", userId: u.id },
    });
    const wsId = await ensurePersonalWorkspace(u.id, u.email);
    const reloaded = await prisma.guide.findUnique({ where: { id: g.id } });
    expect(reloaded?.workspaceId).toBe(wsId);
  });
});

describe("membership administration", () => {
  it("adds an existing user directly and tokenizes an unknown email", async () => {
    const owner = await mkUser("owner@x.com");
    const teammate = await mkUser("mate@x.com");
    const ws = await createWorkspace(owner.id, "Team");

    const added = await inviteMember(ws.id, owner.id, "mate@x.com", "editor");
    expect(added.kind).toBe("added");
    expect(await getRole(teammate.id, ws.id)).toBe("editor");

    const invited = await inviteMember(ws.id, owner.id, "new@x.com", "viewer");
    expect(invited.kind).toBe("invited");
    if (invited.kind === "invited") expect(invited.token).toBeTruthy();
  });

  it("redeems an invite token for a new member", async () => {
    const owner = await mkUser("o2@x.com");
    const joiner = await mkUser("join@x.com");
    const ws = await createWorkspace(owner.id, "Team2");
    const res = await inviteMember(ws.id, owner.id, "join@x.com".toUpperCase(), "admin");
    // Existing user, so added directly — force a token path with a brand-new email:
    const invite = await inviteMember(ws.id, owner.id, "fresh@x.com", "editor");
    expect(res.kind).toBe("added");
    if (invite.kind === "invited") {
      const wsId = await acceptInvite(invite.token, joiner.id);
      expect(wsId).toBe(ws.id);
      // Second accept of the same token is refused.
      expect(await acceptInvite(invite.token, joiner.id)).toBeNull();
    }
  });

  it("won't demote or remove the last owner", async () => {
    const owner = await mkUser("solo@x.com");
    const ws = await createWorkspace(owner.id, "Solo");
    expect(await changeRole(ws.id, owner.id, "admin")).toBe(false);
    expect(await removeMember(ws.id, owner.id)).toBe(false);
    expect(await getRole(owner.id, ws.id)).toBe("owner");
  });
});

describe("guide authorization", () => {
  it("uses workspace role for workspace-owned guides", async () => {
    const owner = await mkUser("wo@x.com");
    const viewer = await mkUser("wv@x.com");
    const ws = await createWorkspace(owner.id, "WS");
    await inviteMember(ws.id, owner.id, "wv@x.com", "viewer");
    const guide = fakeGuide({ workspaceId: ws.id, userId: owner.id });

    expect(await guideRole(viewer.id, guide)).toBe("viewer");
    expect(await canAccessGuide(viewer.id, guide, "viewer")).toBe(true);
    expect(await canAccessGuide(viewer.id, guide, "editor")).toBe(false);
    expect(await canAccessGuide(owner.id, guide, "owner")).toBe(true);
  });

  it("falls back to creator-only for legacy guides with no workspace", async () => {
    const creator = await mkUser("lc@x.com");
    const other = await mkUser("lo@x.com");
    const guide = fakeGuide({ workspaceId: null, userId: creator.id });
    expect(await guideRole(creator.id, guide)).toBe("owner");
    expect(await canAccessGuide(other.id, guide, "viewer")).toBe(false);
  });
});
