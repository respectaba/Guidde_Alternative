/**
 * Renders a guide to an MP4. For each step: draw FPS*duration frames with an
 * eased Ken-Burns zoom toward the click point (via drawFrame), mux them with the
 * step's narration audio (existing clip, freshly synthesized, or silence), then
 * concatenate all step segments with ffmpeg. Returns the final MP4 bytes.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import type { BrandKit, Guide, Step } from "@guide/shared";
import { clamp01 } from "@guide/shared";
import { drawCover, drawOutro, drawFrame } from "./frame";
import { mediaLocalPath, saveMedia } from "@/lib/storage";
import { serverTtsAvailable, synthesize, type TtsConfig } from "@/lib/ai/tts";

const execFileP = promisify(execFile);
const FFMPEG = (ffmpegPath as unknown as string) || "ffmpeg";

const W = 1280;
const H = 720;
const FPS = 25;
const ZMAX = 1.5;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

async function ffmpeg(args: string[]) {
  return execFileP(FFMPEG, args, { maxBuffer: 1 << 26 });
}

/** Parse a media file's duration (seconds) from ffmpeg stderr. */
async function probeDuration(path: string): Promise<number | null> {
  try {
    await ffmpeg(["-i", path]);
    return null;
  } catch (e) {
    const err = e as { stderr?: string };
    const m = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(err.stderr ?? "");
    if (!m) return null;
    return +m[1] * 3600 + +m[2] * 60 + +m[3];
  }
}

function estimateDuration(caption: string): number {
  const words = Math.max(1, caption.trim().split(/\s+/).length);
  return Math.min(10, Math.max(2.5, (words / 165) * 60 + 0.8));
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, comma);
  const data = dataUrl.slice(comma + 1);
  return meta.includes(";base64")
    ? Buffer.from(data, "base64")
    : Buffer.from(decodeURIComponent(data), "utf8");
}

/** Resolve the on-disk audio path for a step, synthesizing if needed. */
async function resolveAudio(
  guide: Guide,
  step: Step,
  tts: TtsConfig,
): Promise<string | null> {
  if (step.audioUrl) {
    const file = step.audioUrl.split("?")[0].split("/").pop();
    if (file) {
      const p = await mediaLocalPath("audio", guide.id, file);
      if (p) return p;
    }
  }
  if (serverTtsAvailable(tts)) {
    const { audio, ext } = await synthesize(step.caption, tts);
    await saveMedia("audio", guide.id, `${step.id}.${ext}`, audio);
    return mediaLocalPath("audio", guide.id, `${step.id}.${ext}`);
  }
  return null;
}

async function renderStepSegment(
  guide: Guide,
  step: Step,
  workDir: string,
  index: number,
  tts: TtsConfig,
): Promise<string> {
  const img = await loadImage(dataUrlToBuffer(step.screenshot));

  const audioPath = await resolveAudio(guide, step, tts);
  const duration =
    (audioPath ? await probeDuration(audioPath) : null) ?? estimateDuration(step.caption);
  const frames = Math.max(1, Math.round(duration * FPS));

  // Focal point (click) in canvas px, clamped so the zoomed view stays on-canvas.
  const rectAr = img.width / img.height;
  const canvasAr = W / H;
  const dispW = rectAr > canvasAr ? W : H * rectAr;
  const dispH = rectAr > canvasAr ? W / rectAr : H;
  const offX = (W - dispW) / 2;
  const offY = (H - dispH) / 2;
  const clickX = offX + clamp01(step.click.x) * dispW;
  const clickY = offY + clamp01(step.click.y) * dispH;
  const halfW = W / (2 * ZMAX);
  const halfH = H / (2 * ZMAX);
  const targetFx = Math.min(W - halfW, Math.max(halfW, clickX));
  const targetFy = Math.min(H - halfH, Math.max(halfH, clickY));

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const stepDir = join(workDir, `step${index}`);
  await execFileP("mkdir", ["-p", stepDir]);

  for (let i = 0; i < frames; i++) {
    const t = frames === 1 ? 1 : i / (frames - 1);
    const p = easeInOut(Math.min(1, t / 0.6)); // reach full zoom at 60%, then hold
    const zoom = 1 + (ZMAX - 1) * p;
    const fx = W / 2 + (targetFx - W / 2) * p;
    const fy = H / 2 + (targetFy - H / 2) * p;
    const ripple = ((i / FPS) % 1.5) / 1.5;
    drawFrame(ctx, img, step, { W, H, zoom, fx, fy, ripple });
    await writeFile(join(stepDir, `f${String(i).padStart(5, "0")}.png`), canvas.toBuffer("image/png"));
  }

  const seg = join(workDir, `seg${index}.mp4`);
  const args = ["-y", "-framerate", String(FPS), "-i", join(stepDir, "f%05d.png")];
  if (audioPath) {
    args.push("-i", audioPath);
  } else {
    args.push("-f", "lavfi", "-i", `anullsrc=r=44100:cl=stereo`);
  }
  args.push(
    "-t", duration.toFixed(3),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k",
    "-shortest",
    seg,
  );
  await ffmpeg(args);
  return seg;
}

/** Render the branded cover as a single held image + optional title narration. */
async function renderCoverSegment(
  guide: Guide,
  brand: BrandKit,
  workDir: string,
  tts: TtsConfig,
): Promise<string> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  let logo = null;
  if (brand.logo) {
    try {
      logo = await loadImage(dataUrlToBuffer(brand.logo));
    } catch {
      /* ignore bad logo */
    }
  }
  drawCover(ctx, {
    W,
    H,
    title: guide.title,
    subtitle: guide.subtitle,
    accent: brand.accentColor || "#6366f1",
    brandName: brand.name,
    logo,
  });
  const coverPng = join(workDir, "cover.png");
  await writeFile(coverPng, canvas.toBuffer("image/png"));

  // Narrate the title over the cover when server TTS is available; else hold silent.
  const narration = [guide.title, guide.subtitle].filter(Boolean).join(". ");
  let audioPath: string | null = null;
  if (serverTtsAvailable(tts)) {
    try {
      const { audio, ext } = await synthesize(narration, tts);
      audioPath = join(workDir, `cover.${ext}`);
      await writeFile(audioPath, audio);
    } catch {
      audioPath = null;
    }
  }
  const duration = (audioPath ? await probeDuration(audioPath) : null) ?? 3.5;

  const seg = join(workDir, "seg-cover.mp4");
  const args = ["-y", "-loop", "1", "-i", coverPng];
  if (audioPath) args.push("-i", audioPath);
  else args.push("-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo");
  args.push(
    "-t", duration.toFixed(3),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k",
    "-shortest", seg,
  );
  await ffmpeg(args);
  return seg;
}

/** Resolve the guide's background-music file on disk, if any. */
async function resolveMusic(guide: Guide): Promise<string | null> {
  if (!guide.musicUrl) return null;
  const file = guide.musicUrl.split("?")[0].split("/").pop();
  if (!file) return null;
  return mediaLocalPath("audio", guide.id, file);
}

/** Render the branded outro (held image + optional "thanks" narration). */
async function renderOutroSegment(
  guide: Guide,
  brand: BrandKit,
  workDir: string,
  tts: TtsConfig,
): Promise<string> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  let logo = null;
  if (brand.logo) {
    try {
      logo = await loadImage(dataUrlToBuffer(brand.logo));
    } catch {
      /* ignore */
    }
  }
  drawOutro(ctx, {
    W,
    H,
    accent: brand.accentColor || "#6366f1",
    brandName: brand.name,
    logo,
    ctaText: guide.ctaText,
  });
  const png = join(workDir, "outro.png");
  await writeFile(png, canvas.toBuffer("image/png"));

  let audioPath: string | null = null;
  if (serverTtsAvailable(tts)) {
    try {
      const { audio, ext } = await synthesize("Thanks for watching", tts);
      audioPath = join(workDir, `outro.${ext}`);
      await writeFile(audioPath, audio);
    } catch {
      audioPath = null;
    }
  }
  const duration = (audioPath ? await probeDuration(audioPath) : null) ?? 3;

  const seg = join(workDir, "seg-outro.mp4");
  const args = ["-y", "-loop", "1", "-i", png];
  if (audioPath) args.push("-i", audioPath);
  else args.push("-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo");
  args.push(
    "-t", duration.toFixed(3),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k",
    "-shortest", seg,
  );
  await ffmpeg(args);
  return seg;
}

export async function exportGuideToVideo(
  guide: Guide,
  tts: TtsConfig,
  brand: BrandKit,
): Promise<Buffer> {
  if (guide.steps.length === 0) throw new Error("Guide has no steps.");
  const workDir = await mkdtemp(join(tmpdir(), "vid-"));
  try {
    const segs: string[] = [];
    if (guide.showCover !== false) {
      segs.push(await renderCoverSegment(guide, brand, workDir, tts));
    }
    for (let i = 0; i < guide.steps.length; i++) {
      segs.push(await renderStepSegment(guide, guide.steps[i], workDir, i, tts));
    }
    if (guide.showOutro !== false) {
      segs.push(await renderOutroSegment(guide, brand, workDir, tts));
    }
    const listPath = join(workDir, "list.txt");
    await writeFile(listPath, segs.map((s) => `file '${s}'`).join("\n"), "utf8");

    const musicPath = await resolveMusic(guide);
    const out = join(workDir, "out.mp4");
    if (musicPath) {
      // Mix looped background music under the narration (kept prominent).
      await ffmpeg([
        "-y", "-f", "concat", "-safe", "0", "-i", listPath,
        "-stream_loop", "-1", "-i", musicPath,
        "-filter_complex",
        "[1:a]volume=0.12[m];[0:a][m]amix=inputs=2:duration=first:normalize=0[a]",
        "-map", "0:v", "-map", "[a]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(FPS),
        "-c:a", "aac", "-ar", "44100", "-ac", "2",
        "-movflags", "+faststart",
        out,
      ]);
    } else {
      // Re-encode on concat so mismatched segment params can't corrupt the join.
      await ffmpeg([
        "-y", "-f", "concat", "-safe", "0", "-i", listPath,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(FPS),
        "-c:a", "aac", "-ar", "44100", "-ac", "2",
        "-movflags", "+faststart",
        out,
      ]);
    }
    return await readFile(out);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
