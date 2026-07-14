import { defineConfig, loadEnv } from "vite"
import { resolve } from "path"
import { createVitePlugins } from "./vite.plugins"

const externalPackages = [
  "vue",
  "vant",
  "@schemx/core",
  "@schemx/vue",
  "classnames",
  "dayjs",
  "es-toolkit",
]

function createExternalMatcher(packages: string[]) {
  return (id: string) =>
    packages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`))
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname, "")
  // VITE_USE_SOURCE 仅用于 dev 热更新（引用源码）；build 一律走外部依赖产物
  const useSource = command === "serve" && env.VITE_USE_SOURCE === "true"
  const analyze = env.VITE_ANALYZE === "true"
  const isExternal = createExternalMatcher(externalPackages)

  return {
    resolve: {
      alias: {
        ...(useSource
          ? {
              "@schemx/core": resolve(__dirname, "../core/src/index.ts"),
              "@schemx/vue": resolve(__dirname, "../vue/src/index.ts"),
            }
          : {}),
      },
    },
    css: {
      preprocessorOptions: {
        // 使用 modern API，避免 Dart Sass legacy-js-api 弃用警告刷屏
        scss: { api: "modern-compiler" },
      },
    },
    plugins: createVitePlugins({ analyze }),
    build: {
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "schemxVant",
        formats: ["es", "cjs"],
        fileName: (format) => {
          if (format === "es") return "index.mjs"
          return "index.cjs"
        },
      },
      rollupOptions: {
        external: isExternal,
        output: {
          exports: "named",
        },
        treeshake: {
          moduleSideEffects: "no-external",
        },
      },
      sourcemap: true,
      minify: "terser",
    },
  }
})
