import { defineConfig, loadEnv } from "vite"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import dts from "vite-plugin-dts"
import { visualizer } from "rollup-plugin-visualizer"
import { resolve } from "path"
import { injectStyleCss } from "@plugins/injectStyleCss"

const externalPackages = ["vue", "@schemx/core", "classnames", "dayjs", "es-toolkit"]

function isExternal(id: string) {
  return externalPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`))
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname, "")
  // VITE_USE_SOURCE 仅用于 dev 热更新（引用源码）；build 一律走外部依赖产物
  const useSource = command === "serve" && env.VITE_USE_SOURCE === "true"
  const analyze = env.VITE_ANALYZE === "true"

  return {
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
      injectStyleCss(),
      dts({
        include: ["src/**/*.ts", "src/**/*.tsx"],
        outDir: "dist",
        tsconfigPath: "tsconfig.build.json",
        // rollupTypes: true,
      }),
      analyze &&
        visualizer({
          filename: resolve(__dirname, "dist/analyze.html"),
          gzipSize: true,
          brotliSize: true,
          open: false,
          template: "treemap",
          title: "@schemx/vue bundle analysis",
        }),
    ].filter(Boolean),
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
