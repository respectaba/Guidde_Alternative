import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./vitest.global-setup.ts"],
    // Route handlers share a single Prisma client + test DB file, so run test
    // files serially to avoid cross-file interference.
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./test.db",
      NODE_ENV: "test",
      // Disable the agent proxy in tests so egressFetch uses the (stubbable)
      // global fetch — the provider tests mock fetch directly.
      HTTPS_PROXY: "",
      https_proxy: "",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@guide/shared": path.resolve(__dirname, "../packages/shared/src/index.ts"),
    },
  },
});
