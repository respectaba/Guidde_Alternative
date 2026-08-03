import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getStats, recordEvent, viewCounts } from "@/lib/analytics";

beforeEach(async () => {
  await prisma.guideEvent.deleteMany();
  await prisma.guide.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function mkGuide(slug: string) {
  const u = await prisma.user.create({ data: { email: `${slug}@x.com`, passwordHash: "x:y" } });
  return prisma.guide.create({
    data: { title: "G", publicSlug: slug, isPublic: true, steps: "[]", userId: u.id },
  });
}

describe("analytics", () => {
  it("aggregates views, completions, rate, and a 7-day series", async () => {
    const g = await mkGuide("stats1");
    await recordEvent(g.id, "view", "public");
    await recordEvent(g.id, "view", "embed");
    await recordEvent(g.id, "view", "public");
    await recordEvent(g.id, "complete", "public");

    const s = await getStats(g.id);
    expect(s.views).toBe(3);
    expect(s.completions).toBe(1);
    expect(s.completionRate).toBeCloseTo(1 / 3, 5);
    expect(s.last7).toHaveLength(7);
    // all three views are today (last bucket)
    expect(s.last7[6].views).toBe(3);
    expect(s.last7.reduce((a, d) => a + d.views, 0)).toBe(3);
  });

  it("handles zero views without dividing by zero", async () => {
    const g = await mkGuide("stats2");
    const s = await getStats(g.id);
    expect(s).toMatchObject({ views: 0, completions: 0, completionRate: 0 });
  });

  it("viewCounts returns per-guide totals for many guides", async () => {
    const a = await mkGuide("va");
    const b = await mkGuide("vb");
    await recordEvent(a.id, "view", "public");
    await recordEvent(a.id, "view", "embed");
    await recordEvent(b.id, "view", "public");
    await recordEvent(a.id, "complete", "public"); // not counted as a view

    const counts = await viewCounts([a.id, b.id]);
    expect(counts.get(a.id)).toBe(2);
    expect(counts.get(b.id)).toBe(1);
  });
});
