import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for a lean production Docker image.
  output: "standalone",
  // Transpile the shared workspace package (it ships raw TS).
  transpilePackages: ["@guide/shared"],
  experimental: {
    // Monorepo: trace from the repo root so the hoisted node_modules and the
    // shared workspace package are included in the standalone output.
    outputFileTracingRoot: path.join(__dirname, ".."),
    // Guides carry base64 screenshots, so server action / route bodies are large.
    serverActions: {
      bodySizeLimit: "25mb",
    },
    // Keep native/binary + proxy deps out of the webpack bundle (loaded at runtime).
    serverComponentsExternalPackages: ["@napi-rs/canvas", "ffmpeg-static", "undici"],
  },
};

export default nextConfig;
