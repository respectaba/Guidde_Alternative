/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile the shared workspace package (it ships raw TS).
  transpilePackages: ["@guide/shared"],
  experimental: {
    // Guides carry base64 screenshots, so server action / route bodies are large.
    serverActions: {
      bodySizeLimit: "25mb",
    },
    // Keep native/binary deps out of the webpack bundle (loaded at runtime).
    serverComponentsExternalPackages: ["@napi-rs/canvas", "ffmpeg-static"],
  },
};

export default nextConfig;
