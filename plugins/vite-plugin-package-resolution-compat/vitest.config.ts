import path from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@schemx/vite-plugin-realpath-fallback": path.resolve(
        __dirname,
        "../vite-plugin-realpath-fallback/src/index.ts"
      ),
    },
  },
  test: {
    environment: "node",
  },
})
