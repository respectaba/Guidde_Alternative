/**
 * Server-side text-to-speech. One `synthesize()` entry point; the engine is
 * chosen by TTS_PROVIDER so callers never branch:
 *
 *   openai      -> OpenAI audio/speech (neural, multi-voice)   [needs TTS_API_KEY]
 *   elevenlabs  -> ElevenLabs TTS (neural, multi-voice)        [needs TTS_API_KEY]
 *   espeak      -> offline espeak-ng (robotic but zero-key, works anywhere)
 *   browser     -> not synthesized here; playback uses Web Speech client-side
 *
 * Returns raw audio bytes + the container so the caller can persist/serve it.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export interface SynthResult {
  audio: Buffer;
  ext: "mp3" | "wav";
  mime: string;
}

export type TtsEngine = "openai" | "elevenlabs" | "espeak" | "browser";

export function ttsEngine(): TtsEngine {
  const p = (process.env.TTS_PROVIDER ?? "browser").toLowerCase();
  if (p === "openai" || p === "elevenlabs" || p === "espeak") return p;
  // "service" is a legacy alias — resolve to a concrete server engine.
  if (p === "service") return process.env.TTS_API_KEY ? "openai" : "espeak";
  return "browser";
}

/** True when server-side synthesis is possible with the current config. */
export function serverTtsAvailable(): boolean {
  return ttsEngine() !== "browser";
}

export async function synthesize(text: string, voice?: string): Promise<SynthResult> {
  const engine = ttsEngine();
  const clean = text.trim() || "Step";
  switch (engine) {
    case "openai":
      return openaiTts(clean, voice);
    case "elevenlabs":
      return elevenLabsTts(clean, voice);
    case "espeak":
      return espeakTts(clean, voice);
    default:
      throw new Error("Server TTS not configured (TTS_PROVIDER=browser).");
  }
}

async function openaiTts(text: string, voice?: string): Promise<SynthResult> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TTS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.TTS_MODEL ?? "gpt-4o-mini-tts",
      voice: voice ?? process.env.TTS_VOICE ?? "alloy",
      input: text,
      response_format: "mp3",
    }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${await res.text()}`);
  return { audio: Buffer.from(await res.arrayBuffer()), ext: "mp3", mime: "audio/mpeg" };
}

async function elevenLabsTts(text: string, voice?: string): Promise<SynthResult> {
  const voiceId = voice ?? process.env.TTS_VOICE ?? "21m00Tcm4TlvDq8ikWAM";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.TTS_API_KEY ?? "",
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: process.env.TTS_MODEL ?? "eleven_turbo_v2_5",
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${await res.text()}`);
  return { audio: Buffer.from(await res.arrayBuffer()), ext: "mp3", mime: "audio/mpeg" };
}

/** Offline engine — no key required. Requires the `espeak-ng` binary on PATH. */
async function espeakTts(text: string, voice?: string): Promise<SynthResult> {
  const dir = await mkdtemp(join(tmpdir(), "tts-"));
  const txtPath = join(dir, "in.txt");
  const wavPath = join(dir, "out.wav");
  try {
    // Pass text via a file to avoid shell-escaping issues with arbitrary captions.
    await writeFile(txtPath, text, "utf8");
    await execFileP("espeak-ng", [
      "-v",
      voice ?? process.env.TTS_VOICE ?? "en-us",
      "-s",
      "165",
      "-f",
      txtPath,
      "-w",
      wavPath,
    ]);
    const audio = await readFile(wavPath);
    return { audio, ext: "wav", mime: "audio/wav" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
