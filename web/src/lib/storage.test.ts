import { afterAll, describe, expect, it } from "vitest";
import { rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { LocalStorage, localDir } from "@/lib/storage/local";
import { mediaUrl, storage } from "@/lib/storage";

const GUIDE = "test-storage-guide";

afterAll(async () => {
  await rm(localDir("audio", GUIDE), { recursive: true, force: true });
  await rm(localDir("video", GUIDE), { recursive: true, force: true });
});

describe("mediaUrl", () => {
  it("builds a stable app-relative url", () => {
    expect(mediaUrl("audio", "g1", "a.mp3")).toBe("/api/media/audio/g1/a.mp3");
  });
});

describe("local storage driver", () => {
  const store = new LocalStorage();

  it("saves and returns the media url", async () => {
    const url = await store.save("audio", GUIDE, "clip.mp3", Buffer.from("hello"));
    expect(url).toBe(mediaUrl("audio", GUIDE, "clip.mp3"));
    // Bytes landed on disk.
    const onDisk = await readFile(join(localDir("audio", GUIDE), "clip.mp3"));
    expect(onDisk.toString()).toBe("hello");
  });

  it("reads bytes back and reports a local path", async () => {
    await store.save("audio", GUIDE, "clip2.mp3", Buffer.from("world"));
    const buf = await store.read("audio", GUIDE, "clip2.mp3");
    expect(buf?.toString()).toBe("world");
    const p = await store.toLocalPath("audio", GUIDE, "clip2.mp3");
    expect(p).toContain("clip2.mp3");
  });

  it("returns null for missing objects", async () => {
    expect(await store.read("audio", GUIDE, "nope.mp3")).toBeNull();
    expect(await store.toLocalPath("audio", GUIDE, "nope.mp3")).toBeNull();
  });
});

describe("storage facade", () => {
  it("defaults to the local driver", () => {
    // STORAGE_DRIVER unset in tests → local instance.
    expect(storage().constructor.name).toBe("LocalStorage");
  });
});
