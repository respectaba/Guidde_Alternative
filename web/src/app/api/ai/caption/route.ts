/**
 * POST /api/ai/caption — regenerate a single step's caption.
 * Uses Claude when AI_PROVIDER=claude (+ key configured), else the heuristic.
 * Always returns a caption; never hard-fails.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { elementMetaSchema } from "@guide/shared";
import { generateServerCaption } from "@/lib/ai/provider";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  element: elementMetaSchema,
  order: z.number().optional(),
  previousCaptions: z.array(z.string()).optional(),
});

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return error("Validation failed", 422, parsed.error.flatten());
  }

  const caption = await generateServerCaption(parsed.data);
  return json({ caption });
}
