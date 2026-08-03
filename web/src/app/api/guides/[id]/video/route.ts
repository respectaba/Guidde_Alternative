/**
 * POST /api/guides/:id/video — enqueue an MP4 render job (returns { jobId }).
 * GET  /api/guides/:id/video — status of the guide's latest render job.
 * Rendering runs in a background worker; poll GET or /api/jobs/:id for progress.
 */
import type { NextRequest } from "next/server";
import { getGuide } from "@/lib/guides";
import { authenticateRequest } from "@/lib/auth";
import { canAccessGuide } from "@/lib/workspace";
import { enqueueJob } from "@/lib/jobs/queue";
import { ensureWorker } from "@/lib/jobs/worker";
import { prisma } from "@/lib/db";
import { error, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function OPTIONS() {
  return preflight();
}

async function guard(req: NextRequest, id: string) {
  const user = await authenticateRequest(req);
  if (!user) return { err: error("Not authenticated", 401) };
  const guide = await getGuide(id);
  if (!guide) return { err: error("Guide not found", 404) };
  if (!(await canAccessGuide(user.id, guide, "editor"))) return { err: error("Forbidden", 403) };
  return { user, guide };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await guard(req, params.id);
  if (r.err) return r.err;
  const job = await enqueueJob(params.id, "video");
  ensureWorker();
  return json({ jobId: job.id, status: job.status }, { status: 202 });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await guard(req, params.id);
  if (r.err) return r.err;
  const job = await prisma.job.findFirst({
    where: { guideId: params.id, type: "video" },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return json({ status: "none" });
  return json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    videoUrl: job.status === "done" ? job.result : null,
    error: job.error,
  });
}
