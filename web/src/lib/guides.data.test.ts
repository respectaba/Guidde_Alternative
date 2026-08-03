import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Step } from "@guide/shared";
import { prisma } from "@/lib/db";
import {
  createGuide,
  deleteGuide,
  getGuide,
  getGuideBySlug,
  listGuides,
  updateGuide,
} from "@/lib/guides";
import { ensurePersonalWorkspace } from "@/lib/workspace";

function fixtureStep(over: Partial<Step> = {}): Step {
  return {
    id: "s1",
    order: 0,
    screenshot: "data:image/png;base64,AAAA",
    viewport: { w: 1280, h: 720, dpr: 1 },
    click: { x: 0.5, y: 0.5 },
    caption: "Click the button",
    element: {
      selector: "button",
      tagName: "button",
      text: "Go",
      role: "button",
      boundingRect: { x: 0.4, y: 0.4, w: 0.1, h: 0.05 },
    },
    annotations: [],
    blurRegions: [],
    ...over,
  };
}

async function mkUser(email: string) {
  const user = await prisma.user.create({ data: { email, passwordHash: "x:y" } });
  const workspaceId = await ensurePersonalWorkspace(user.id, email);
  return { ...user, workspaceId };
}

beforeEach(async () => {
  await prisma.guide.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("guides data layer (ownership)", () => {
  it("creates a guide owned by the user, with a slug and steps", async () => {
    const u = await mkUser("a@example.com");
    const g = await createGuide({ title: "Test", steps: [fixtureStep()] }, u.id, u.workspaceId);
    expect(g.userId).toBe(u.id);
    expect(g.publicSlug).toBeTruthy();
    expect(g.isPublic).toBe(false);
    expect(g.steps).toHaveLength(1);
  });

  it("lists only the owner's guides with a thumbnail", async () => {
    const u1 = await mkUser("u1@example.com");
    const u2 = await mkUser("u2@example.com");
    await createGuide({ title: "Mine", steps: [fixtureStep()] }, u1.id, u1.workspaceId);
    await createGuide({ title: "Theirs", steps: [fixtureStep()] }, u2.id, u2.workspaceId);

    const mine = await listGuides(u1.workspaceId);
    expect(mine).toHaveLength(1);
    expect(mine[0].title).toBe("Mine");
    expect(mine[0].thumbnail).toContain("data:image");
    expect(await listGuides(u2.workspaceId)).toHaveLength(1);
  });

  it("getGuide exposes userId so routes can check ownership", async () => {
    const u = await mkUser("o@example.com");
    const g = await createGuide({ title: "Owned", steps: [fixtureStep()] }, u.id, u.workspaceId);
    const loaded = await getGuide(g.id);
    expect(loaded?.userId).toBe(u.id);
  });

  it("updates fields and re-indexes step order", async () => {
    const u = await mkUser("e@example.com");
    const g = await createGuide({ title: "Edit", steps: [fixtureStep()] }, u.id, u.workspaceId);
    const updated = await updateGuide(g.id, {
      isPublic: true,
      steps: [fixtureStep({ caption: "Updated" })],
    });
    expect(updated?.isPublic).toBe(true);
    expect(updated?.steps[0].caption).toBe("Updated");
    expect(updated?.steps[0].order).toBe(0);
  });

  it("resolves a public guide by slug", async () => {
    const u = await mkUser("p@example.com");
    const g = await createGuide({ title: "Pub", steps: [fixtureStep()] }, u.id, u.workspaceId);
    await updateGuide(g.id, { isPublic: true });
    const bySlug = await getGuideBySlug(g.publicSlug);
    expect(bySlug?.id).toBe(g.id);
  });

  it("deletes a guide", async () => {
    const u = await mkUser("d@example.com");
    const g = await createGuide({ title: "Del", steps: [fixtureStep()] }, u.id, u.workspaceId);
    expect(await deleteGuide(g.id)).toBe(true);
    expect(await getGuide(g.id)).toBeNull();
  });
});
