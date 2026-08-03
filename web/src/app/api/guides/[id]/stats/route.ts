/**
 * GET /api/guides/:id/stats — owner-only viewer analytics for a guide.
 */
import type { NextRequest } from "next/server";
import { getGuide } from "@/lib/guides";
import { authenticateRequest } from "@/lib/auth";
import { getStats } from "@/lib/analytics";
import { error, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);
  const guide = await getGuide(params.id);
  if (!guide) return error("Guide not found", 404);
  if (guide.userId !== user.id) return error("Forbidden", 403);
  return json(await getStats(params.id));
}
