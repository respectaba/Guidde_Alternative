import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { DEFAULT_ACCENT, getBrandKit, upsertBrandKit } from "@/lib/brand";

beforeEach(async () => {
  await prisma.brandKit.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function mkUser(email: string) {
  return prisma.user.create({ data: { email, passwordHash: "x:y" } });
}

describe("brand kit", () => {
  it("returns sensible defaults when none is set (and for anonymous)", async () => {
    const u = await mkUser("nobrand@example.com");
    const def = await getBrandKit(u.id);
    expect(def).toEqual({ name: null, logo: null, accentColor: DEFAULT_ACCENT });
    expect(await getBrandKit(null)).toEqual({ name: null, logo: null, accentColor: DEFAULT_ACCENT });
  });

  it("upserts and reads back name, logo, and accent", async () => {
    const u = await mkUser("brand@example.com");
    await upsertBrandKit(u.id, {
      name: "Acme",
      logo: "data:image/png;base64,AAAA",
      accentColor: "#ff0088",
    });
    const b = await getBrandKit(u.id);
    expect(b).toEqual({ name: "Acme", logo: "data:image/png;base64,AAAA", accentColor: "#ff0088" });

    // Update is idempotent / overwrites.
    await upsertBrandKit(u.id, { name: "Acme 2", accentColor: "#00ff88" });
    const b2 = await getBrandKit(u.id);
    expect(b2.name).toBe("Acme 2");
    expect(b2.accentColor).toBe("#00ff88");
  });
});
