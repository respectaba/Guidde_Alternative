import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { resolveTtsConfig } from "@/lib/ai/tts";

const ENV_KEYS = ["TTS_PROVIDER", "TTS_API_KEY", "TTS_VOICE", "TTS_MODEL"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(async () => {
  await prisma.ttsSetting.deleteMany();
  await prisma.user.deleteMany();
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function mkUser(email: string) {
  return prisma.user.create({ data: { email, passwordHash: "x:y" } });
}

describe("resolveTtsConfig precedence", () => {
  it("prefers the user's own key over everything", async () => {
    const u = await mkUser("byo@example.com");
    await prisma.ttsSetting.create({
      data: { userId: u.id, provider: "openai", apiKeyEnc: encryptSecret("sk-user"), voice: "nova" },
    });
    process.env.TTS_PROVIDER = "openai";
    process.env.TTS_API_KEY = "sk-env"; // should be ignored in favor of the user key

    const cfg = await resolveTtsConfig(u.id);
    expect(cfg).toMatchObject({ engine: "openai", apiKey: "sk-user", voice: "nova", source: "user" });
  });

  it("falls back to the operator env key when the user has none", async () => {
    const u = await mkUser("env@example.com");
    process.env.TTS_PROVIDER = "elevenlabs";
    process.env.TTS_API_KEY = "sk-env";

    const cfg = await resolveTtsConfig(u.id);
    expect(cfg).toMatchObject({ engine: "elevenlabs", apiKey: "sk-env", source: "env" });
  });

  it("falls back to offline espeak", async () => {
    process.env.TTS_PROVIDER = "espeak";
    const cfg = await resolveTtsConfig();
    expect(cfg).toMatchObject({ engine: "espeak", source: "offline" });
  });

  it("defaults to browser when nothing is configured", async () => {
    const cfg = await resolveTtsConfig();
    expect(cfg.engine).toBe("browser");
    expect(cfg.source).toBe("none");
  });
});
