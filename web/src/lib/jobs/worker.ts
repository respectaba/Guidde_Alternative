/**
 * In-process job worker. Drains the DB queue one job at a time (single-flight in
 * this process) on a short interval, kicked immediately whenever a job is
 * enqueued. Suitable for a single long-lived Node server (`next start`, Docker).
 *
 * Caveat: this runs inside the web process, so it does not apply to serverless
 * deployments and does not scale horizontally. For multi-node, run this loop as a
 * dedicated worker process against a shared DB (or a real broker) — the queue API
 * in queue.ts is unchanged.
 */
import { claimNextJob, failJob, finishJob, updateProgress, type JobView } from "./queue";
import { getGuide } from "@/lib/guides";
import { resolveTtsConfig } from "@/lib/ai/tts";
import { getBrandKit } from "@/lib/brand";
import { saveMedia } from "@/lib/storage";

let running = false;
let started = false;

async function runVideoJob(job: JobView): Promise<void> {
  const guide = await getGuide(job.guideId);
  if (!guide) {
    await failJob(job.id, "Guide not found");
    return;
  }
  await updateProgress(job.id, 5);
  // Import the (native-dep-heavy) renderer lazily so it only loads when a job runs.
  const { exportGuideToVideo } = await import("@/lib/video/export");
  const tts = await resolveTtsConfig(guide.userId ?? undefined);
  const brand = await getBrandKit(guide.userId);
  await updateProgress(job.id, 10);
  const mp4 = await exportGuideToVideo(guide, tts, brand);
  await updateProgress(job.id, 90);
  const url = await saveMedia("video", guide.id, "guide.mp4", mp4);
  await finishJob(job.id, `${url}?v=${Date.now()}`);
}

async function tick(): Promise<void> {
  if (running) return;
  const job = await claimNextJob();
  if (!job) return;
  running = true;
  try {
    if (job.type === "video") await runVideoJob(job);
    else await failJob(job.id, `Unknown job type: ${job.type}`);
  } catch (e) {
    await failJob(job.id, (e as Error).message || "Job failed");
  } finally {
    running = false;
    // Chain straight into the next queued job instead of waiting for the timer.
    void tick();
  }
}

/** Start the drain loop once per process and kick it immediately. */
export function ensureWorker(): void {
  if (!started) {
    started = true;
    setInterval(() => void tick(), 1500);
  }
  void tick();
}
