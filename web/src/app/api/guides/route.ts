/**
 * Collection endpoint for guides.
 *   GET  /api/guides  -> list summaries (dashboard)
 *   POST /api/guides  -> create a guide (from the extension or the import page)
 */
import type { NextRequest } from "next/server";
import { createGuideSchema } from "@guide/shared";
import { createGuide, listGuides } from "@/lib/guides";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

export async function GET() {
  const guides = await listGuides();
  return json({ guides });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body", 400);
  }

  const parsed = createGuideSchema.safeParse(body);
  if (!parsed.success) {
    return error("Validation failed", 422, parsed.error.flatten());
  }

  const guide = await createGuide(parsed.data);
  return json({ id: guide.id, publicSlug: guide.publicSlug, guide }, { status: 201 });
}
