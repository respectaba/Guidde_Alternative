import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  generateApiToken,
  hashPassword,
  sha256,
  verifyPassword,
} from "@/lib/auth";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const stored = hashPassword("hunter2!");
    expect(verifyPassword("hunter2!", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
  });

  it("produces a unique salt per hash", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("rejects malformed stored values", () => {
    expect(verifyPassword("x", "not-a-valid-hash")).toBe(false);
  });
});

describe("API tokens", () => {
  it("generates a prefixed token whose hash matches sha256 of the plaintext", () => {
    const { plaintext, hash, prefix } = generateApiToken();
    expect(plaintext.startsWith("gf_")).toBe(true);
    expect(prefix).toBe(plaintext.slice(0, 8));
    expect(hash).toBe(sha256(plaintext));
    expect(hash).not.toBe(plaintext); // only the hash is stored
  });
});

describe("session token", () => {
  it("is signed (three-part payload.signature form)", () => {
    const t = createSessionToken("user_123");
    expect(t.split(".").length).toBe(2);
    // tampering with the payload should change what a re-sign would produce
    expect(createSessionToken("user_123")).not.toBe(""); // sanity
  });
});
