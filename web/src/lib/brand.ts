/**
 * Per-tenant brand kit data access. Applied to guide cover slides and exports.
 */
import type { BrandKit } from "@guide/shared";
import { prisma } from "./db";
import { DEFAULT_ACCENT } from "./brandConstants";

export { DEFAULT_ACCENT };

/** The brand kit for a user, with defaults filled in. Never null. */
export async function getBrandKit(userId: string | null | undefined): Promise<BrandKit> {
  if (userId) {
    const b = await prisma.brandKit.findUnique({ where: { userId } });
    if (b) {
      return {
        name: b.name ?? null,
        logo: b.logo ?? null,
        accentColor: b.accentColor || DEFAULT_ACCENT,
      };
    }
  }
  return { name: null, logo: null, accentColor: DEFAULT_ACCENT };
}

export async function upsertBrandKit(
  userId: string,
  input: { name?: string | null; logo?: string | null; accentColor?: string },
): Promise<BrandKit> {
  const data = {
    name: input.name ?? null,
    logo: input.logo ?? null,
    accentColor: input.accentColor || DEFAULT_ACCENT,
  };
  const b = await prisma.brandKit.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return { name: b.name ?? null, logo: b.logo ?? null, accentColor: b.accentColor };
}
