/**
 * Per-tenant brand kit.
 *   GET -> { name, logo, accentColor }
 *   PUT -> upsert name / logo (data URL) / accentColor
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { getBrandKit, upsertBrandKit } from "@/lib/brand";
import { error, json } from "@/lib/http";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  // Data URL (image/*) or null to clear. Cap ~1.5MB base64.
  logo: z
    .string()
    .max(2_000_000)
    .regex(/^data:image\//, "Logo must be an image data URL")
    .nullable()
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Accent must be a hex color like #6366f1")
    .optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return error("Not authenticated", 401);
  return json(await getBrandKit(user.id));
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return error("Not authenticated", 401);

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return error("Validation failed", 422, parsed.error.flatten());

  const brand = await upsertBrandKit(user.id, parsed.data);
  return json(brand);
}
