/**
 * GET /api/jobs/:id — poll a background job's status. Authorized via the job's
 * guide (the caller must have viewer access to it).
 */
import type { NextRequest } from "next/server";
import { getGuide } from "@/lib/guides";
import { authenticateRequest } from "@/lib/auth";
import { canAccessGuide } from "@/lib/workspace";
import { getJob } from "@/lib/jobs/queue";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return error("Not authenticated", 401);
  const job = await getJob(params.id);
  if (!job) return error("Job not found", 404);
  const guide = await getGuide(job.guideId);
  if (!guide || !(await canAccessGuide(user.id, guide, "viewer"))) {
    return error("Forbidden", 403);
  }
  return json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    videoUrl: job.status === "done" ? job.result : null,
    error: job.error,
  });
}
