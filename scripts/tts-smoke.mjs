/**
 * Live TTS smoke test. Logs in, calls POST /api/ai/tts with the caller's
 * resolved config (per-tenant key from Settings, or the operator env key), and
 * writes the returned audio to ./out.mp3.
 *
 *   node scripts/tts-smoke.mjs <email> <password> [baseUrl] [text]
 *
 * A 501 means no server voiceover engine is configured for that user (add a key
 * in Settings, or set TTS_PROVIDER). A provider/proxy 403 means the host is
 * blocked by egress policy.
 */
import { writeFile } from "node:fs/promises";

const [email, password, base = "http://localhost:3000", text = "Hello from Guideflow. This is a neural voiceover test."] =
  process.argv.slice(2);

if (!email || !password) {
  console.error("usage: node scripts/tts-smoke.mjs <email> <password> [baseUrl] [text]");
  process.exit(1);
}

const login = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) {
  console.error("login failed:", login.status, await login.text());
  process.exit(1);
}
const cookie = login.headers.get("set-cookie")?.split(";")[0];
if (!cookie) {
  console.error("no session cookie returned");
  process.exit(1);
}

const res = await fetch(`${base}/api/ai/tts`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({ text }),
});

if (!res.ok) {
  console.error(`TTS request failed: ${res.status}`, await res.text());
  process.exit(1);
}

const buf = Buffer.from(await res.arrayBuffer());
await writeFile("out.mp3", buf);
console.log(
  `OK — ${res.headers.get("content-type")}, ${buf.length} bytes -> out.mp3`,
);
