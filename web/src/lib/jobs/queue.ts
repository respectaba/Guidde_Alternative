/**
 * DB-backed job queue for slow work (MP4 rendering). Requests enqueue a Job row
 * and return immediately with a jobId; an in-process worker (see worker.ts)
 * claims queued jobs and runs them, updating status/progress/result.
 *
 * A DB queue (not just an in-memory array) means jobs survive a process restart
 * and their status is readable by any request. For a multi-node deployment,
 * swap the worker's claim step for a real broker (Redis/SQS) — the API surface
 * here stays the same.
 */
import { prisma } from "@/lib/db";

export type JobType = "video";
export type JobStatus = "queued" | "running" | "done" | "error";

export interface JobView {
  id: string;
  guideId: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  result: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

function toView(j: {
  id: string;
  guideId: string;
  type: string;
  status: string;
  progress: number;
  result: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}): JobView {
  return {
    id: j.id,
    guideId: j.guideId,
    type: j.type as JobType,
    status: j.status as JobStatus,
    progress: j.progress,
    result: j.result,
    error: j.error,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

/** Enqueue a job, reusing an in-flight one for the same guide+type if present. */
export async function enqueueJob(guideId: string, type: JobType): Promise<JobView> {
  const existing = await prisma.job.findFirst({
    where: { guideId, type, status: { in: ["queued", "running"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return toView(existing);
  const job = await prisma.job.create({ data: { guideId, type } });
  return toView(job);
}

export async function getJob(id: string): Promise<JobView | null> {
  const j = await prisma.job.findUnique({ where: { id } });
  return j ? toView(j) : null;
}

/**
 * Atomically claim the oldest queued job (guarded by an updateMany on the exact
 * status so two workers can't grab the same row). Returns the claimed job.
 */
export async function claimNextJob(): Promise<JobView | null> {
  const next = await prisma.job.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  if (!next) return null;
  const claimed = await prisma.job.updateMany({
    where: { id: next.id, status: "queued" },
    data: { status: "running", progress: 1 },
  });
  if (claimed.count === 0) return null; // lost the race; try again next tick
  const j = await prisma.job.findUnique({ where: { id: next.id } });
  return j ? toView(j) : null;
}

export async function updateProgress(id: string, progress: number): Promise<void> {
  await prisma.job.update({
    where: { id },
    data: { progress: Math.max(0, Math.min(100, Math.round(progress))) },
  });
}

export async function finishJob(id: string, result: string): Promise<void> {
  await prisma.job.update({
    where: { id },
    data: { status: "done", progress: 100, result, error: null },
  });
}

export async function failJob(id: string, error: string): Promise<void> {
  await prisma.job.update({
    where: { id },
    data: { status: "error", error: error.slice(0, 2000) },
  });
}
