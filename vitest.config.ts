import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": r("./src"),
      // `server-only` throws outside Next's server bundles; stub it for tests.
      "server-only": r("./src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Every test file gets a throwaway in-memory Postgres.
    env: { PGLITE_DIR: "memory://", DATABASE_URL: "" },
    // PGlite's first connection in a file (WASM init + migrations) can take a
    // few seconds; the default 5s timeout is too tight for that cold start.
    testTimeout: 20_000,
  },
});
