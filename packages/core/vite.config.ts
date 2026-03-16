import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import dts from "vite-plugin-dts"
import { resolve } from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  plugins: [
    vue(),
    vueJsx(),
    dts({
      include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
      outDir: "dist",
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
    sourcemap: true,
    minify: "terser",
  },
})
