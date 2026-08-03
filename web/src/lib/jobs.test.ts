import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  claimNextJob,
  enqueueJob,
  failJob,
  finishJob,
  getJob,
  updateProgress,
} from "@/lib/jobs/queue";

async function mkGuide() {
  return prisma.guide.create({
    data: { title: "G", publicSlug: `s-${Math.round(performance.now())}-${Math.random()}`, steps: "[]" },
  });
}

beforeEach(async () => {
  await prisma.job.deleteMany();
  await prisma.guide.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("job queue", () => {
  it("enqueues a queued job and reuses an in-flight one", async () => {
    const g = await mkGuide();
    const a = await enqueueJob(g.id, "video");
    expect(a.status).toBe("queued");
    const b = await enqueueJob(g.id, "video");
    expect(b.id).toBe(a.id); // deduped while still queued/running
  });

  it("claims the oldest queued job and flips it to running", async () => {
    const g = await mkGuide();
    const job = await enqueueJob(g.id, "video");
    const claimed = await claimNextJob();
    expect(claimed?.id).toBe(job.id);
    expect(claimed?.status).toBe("running");
    // Nothing left to claim once it's running.
    expect(await claimNextJob()).toBeNull();
  });

  it("tracks progress and terminal states", async () => {
    const g = await mkGuide();
    const job = await enqueueJob(g.id, "video");
    await updateProgress(job.id, 42);
    expect((await getJob(job.id))?.progress).toBe(42);

    await finishJob(job.id, "/api/media/video/x/guide.mp4");
    const done = await getJob(job.id);
    expect(done?.status).toBe("done");
    expect(done?.progress).toBe(100);
    expect(done?.result).toContain("guide.mp4");

    const g2 = await mkGuide();
    const job2 = await enqueueJob(g2.id, "video");
    await failJob(job2.id, "boom");
    const failed = await getJob(job2.id);
    expect(failed?.status).toBe("error");
    expect(failed?.error).toBe("boom");
  });

  it("re-enqueues after a job reaches a terminal state", async () => {
    const g = await mkGuide();
    const first = await enqueueJob(g.id, "video");
    await finishJob(first.id, "/done.mp4");
    const second = await enqueueJob(g.id, "video");
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe("queued");
  });
});
