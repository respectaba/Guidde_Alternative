/**
 * Server-side text-to-speech, tenant-aware.
 *
 * `resolveTtsConfig(userId)` picks the engine + credentials by precedence:
 *   1. the user's own saved key (TtsSetting, decrypted)   — bring-your-own-key
 *   2. the operator's env key (TTS_PROVIDER + TTS_API_KEY) — shared fallback
 *   3. offline espeak-ng (TTS_PROVIDER=espeak)             — zero-key
 *   4. browser (Web Speech, client-side)                  — nothing server-side
 *
 * Neural engines: openai, elevenlabs, google (Cloud Text-to-Speech, API-key auth).
 *
 * `synthesize(text, config)` then runs the chosen engine. Neural providers'
 * fetches go through egressFetch so they work behind an HTTPS proxy.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { egressFetch } from "@/lib/egress";

const execFileP = promisify(execFile);

export interface SynthResult {
  audio: Buffer;
  ext: "mp3" | "wav";
  mime: string;
}

export type TtsEngine = "openai" | "elevenlabs" | "google" | "espeak" | "browser";

/** Neural providers that authenticate with a single API-key string. */
const NEURAL_KEY_ENGINES = ["openai", "elevenlabs", "google"] as const;

export interface TtsConfig {
  engine: TtsEngine;
  apiKey?: string;
  voice?: string;
  model?: string;
  /** Where the config came from — for messaging/telemetry (not secret). */
  source: "user" | "env" | "offline" | "none";
}

function envEngine(): TtsEngine {
  const p = (process.env.TTS_PROVIDER ?? "browser").toLowerCase();
  if (p === "openai" || p === "elevenlabs" || p === "google" || p === "espeak") return p;
  if (p === "service") return process.env.TTS_API_KEY ? "openai" : "espeak";
  return "browser";
}

/** Resolve the effective TTS config for a user (or anonymous when omitted). */
export async function resolveTtsConfig(userId?: string): Promise<TtsConfig> {
  // 1. Per-tenant BYO key.
  if (userId) {
    const s = await prisma.ttsSetting.findUnique({ where: { userId } });
    if (s) {
      try {
        return {
          engine: s.provider as TtsEngine,
          apiKey: decryptSecret(s.apiKeyEnc),
          voice: s.voice ?? undefined,
          model: s.model ?? undefined,
          source: "user",
        };
      } catch {
        // Corrupt/undecryptable (e.g. secret rotated) — fall through to server config.
      }
    }
  }
  // 2. Operator env key.
  const eng = envEngine();
  if ((NEURAL_KEY_ENGINES as readonly string[]).includes(eng) && process.env.TTS_API_KEY) {
    return {
      engine: eng,
      apiKey: process.env.TTS_API_KEY,
      voice: process.env.TTS_VOICE,
      model: process.env.TTS_MODEL,
      source: "env",
    };
  }
  // 3. Offline.
  if (eng === "espeak") {
    return { engine: "espeak", voice: process.env.TTS_VOICE, source: "offline" };
  }
  // 4. Nothing server-side.
  return { engine: "browser", source: "none" };
}

export function serverTtsAvailable(config: TtsConfig): boolean {
  return config.engine !== "browser";
}

export async function synthesize(text: string, config: TtsConfig): Promise<SynthResult> {
  const clean = text.trim() || "Step";
  switch (config.engine) {
    case "openai":
      return openaiTts(clean, config);
    case "elevenlabs":
      return elevenLabsTts(clean, config);
    case "google":
      return googleTts(clean, config);
    case "espeak":
      return espeakTts(clean, config);
    default:
      throw new Error("Server TTS not configured (no key set and TTS_PROVIDER=browser).");
  }
}

async function openaiTts(text: string, config: TtsConfig): Promise<SynthResult> {
  const res = await egressFetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model ?? "gpt-4o-mini-tts",
      voice: config.voice ?? "alloy",
      input: text,
      response_format: "mp3",
    }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${await res.text()}`);
  return { audio: Buffer.from(await res.arrayBuffer()), ext: "mp3", mime: "audio/mpeg" };
}

async function elevenLabsTts(text: string, config: TtsConfig): Promise<SynthResult> {
  const voiceId = config.voice ?? "21m00Tcm4TlvDq8ikWAM";
  const res = await egressFetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": config.apiKey ?? "",
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: config.model ?? "eleven_turbo_v2_5",
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${await res.text()}`);
  return { audio: Buffer.from(await res.arrayBuffer()), ext: "mp3", mime: "audio/mpeg" };
}

/**
 * Google Cloud Text-to-Speech (API-key auth). `voice` is the Google voice name
 * (e.g. "en-US-Neural2-C"); `model` optionally overrides the BCP-47 language code
 * (else it's derived from the voice name, defaulting to en-US). Returns base64 MP3.
 */
async function googleTts(text: string, config: TtsConfig): Promise<SynthResult> {
  const voiceName = config.voice?.trim();
  const languageCode =
    config.model?.trim() ||
    (voiceName && /^[a-z]{2}-[A-Z]{2}/.test(voiceName) ? voiceName.slice(0, 5) : undefined) ||
    "en-US";
  const voice = voiceName ? { languageCode, name: voiceName } : { languageCode };

  const res = await egressFetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(config.apiKey ?? "")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: { text }, voice, audioConfig: { audioEncoding: "MP3" } }),
    },
  );
  if (!res.ok) throw new Error(`Google TTS ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { audioContent?: string };
  if (!data.audioContent) throw new Error("Google TTS returned no audioContent");
  return { audio: Buffer.from(data.audioContent, "base64"), ext: "mp3", mime: "audio/mpeg" };
}

/** Offline engine — no key required. Requires the `espeak-ng` binary on PATH. */
async function espeakTts(text: string, config: TtsConfig): Promise<SynthResult> {
  const dir = await mkdtemp(join(tmpdir(), "tts-"));
  const txtPath = join(dir, "in.txt");
  const wavPath = join(dir, "out.wav");
  try {
    await writeFile(txtPath, text, "utf8");
    await execFileP("espeak-ng", [
      "-v",
      config.voice ?? "en-us",
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
