import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

describe("secret encryption", () => {
  it("round-trips a secret", () => {
    const secret = "sk-proj-abc123-super-secret";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("produces a unique ciphertext each time (random IV)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("fails to decrypt tampered ciphertext (GCM auth)", () => {
    const enc = encryptSecret("hunter2");
    const [iv, tag, data] = enc.split(".");
    const flipped = data[0] === "A" ? "B" : "A";
    const tampered = `${iv}.${tag}.${flipped}${data.slice(1)}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rejects malformed payloads", () => {
    expect(() => decryptSecret("not-valid")).toThrow();
  });
});
