import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import dts from "vite-plugin-dts"
import { resolve } from "path"

const useSource = process.env.VITE_USE_SOURCE === "true"

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      ...(useSource
        ? { "@schemx/core": resolve(__dirname, "../core/src/index.ts") }
        : {}),
    },
  },
  plugins: [
    vue(),
    vueJsx(),
    dts({
      include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
      outDir: "dist",
      // rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "schemxCore",
      formats: ["es", "cjs", "umd"],
      fileName: (format) => {
        if (format === "es") return "index.mjs"
        if (format === "cjs") return "index.cjs"
        return "index.umd.js"
      },
    },
    rollupOptions: {
      external: useSource
        ? ["vue", "classnames", "dayjs", "es-toolkit", "@preact/signals-core"]
        : ["vue", "@schemx/core", "classnames", "dayjs", "es-toolkit"],
      output: {
        globals: {
          vue: "Vue",
          "@schemx/core": "schemxCore",
        },
        exports: "named",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css") return "style.css"
          return assetInfo.name || "asset"
        },
      },
    },
    sourcemap: true,
    minify: "terser",
  },
})
