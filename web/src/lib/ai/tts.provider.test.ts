import { afterEach, describe, expect, it, vi } from "vitest";
import { synthesize } from "@/lib/ai/tts";

function okAudio() {
  return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("neural provider request wiring (no real key needed)", () => {
  it("OpenAI: correct URL, bearer auth, model/voice/input in body", async () => {
    const fetchMock = vi.fn(async () => okAudio());
    vi.stubGlobal("fetch", fetchMock);

    const res = await synthesize("Click the button", {
      engine: "openai",
      apiKey: "sk-test-123",
      voice: "nova",
      source: "user",
    });

    expect(res.ext).toBe("mp3");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    expect((opts as RequestInit).method).toBe("POST");
    const headers = (opts as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test-123");
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body).toMatchObject({ model: "gpt-4o-mini-tts", voice: "nova", input: "Click the button" });
  });

  it("ElevenLabs: voice id in URL, xi-api-key header", async () => {
    const fetchMock = vi.fn(async () => okAudio());
    vi.stubGlobal("fetch", fetchMock);

    await synthesize("hi", { engine: "elevenlabs", apiKey: "xi-key", voice: "VOICEID", source: "user" });

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/v1/text-to-speech/VOICEID");
    const headers = (opts as RequestInit).headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe("xi-key");
  });

  it("throws with the provider status on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    await expect(
      synthesize("x", { engine: "openai", apiKey: "bad", source: "user" }),
    ).rejects.toThrow(/401/);
  });
});
