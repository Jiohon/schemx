import { defineConfig, loadEnv } from "vite"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import dts from "vite-plugin-dts"
import { visualizer } from "rollup-plugin-visualizer"
import { resolve } from "path"

const externalPackages = [
  "vue",
  "simple-async-context",
  "es-toolkit",
  "@preact/signals-core",
]

function isExternal(id: string) {
  return externalPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`))
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "")
  const analyze = env.VITE_ANALYZE === "true"

  return {
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
        rollupTypes: true,
      }),
      analyze &&
        visualizer({
          filename: resolve(__dirname, "dist/analyze.html"),
          gzipSize: true,
          brotliSize: true,
          open: false,
          template: "treemap",
          title: "@schemx/core bundle analysis",
        }),
    ],
    build: {
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "schemxCore",
        formats: ["es", "cjs"],
        fileName: (format) => {
          if (format === "es") return "index.mjs"
          return "index.cjs"
        },
      },
      rollupOptions: {
        external: isExternal,
        output: {
          globals: {
            vue: "Vue",
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
  }
})
