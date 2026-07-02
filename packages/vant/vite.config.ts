import { defineConfig, loadEnv } from "vite"
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import dts from "vite-plugin-dts"
import { visualizer } from "rollup-plugin-visualizer"
import { normalize, resolve } from "path"
import { injectStyleCss } from "@plugins/injectStyleCss"

const externalPackages = [
  "vue",
  "vant",
  "@schemx/core",
  "@schemx/vue",
  "classnames",
  "dayjs",
  "es-toolkit",
]

const standaloneExternalPackages = ["vue", "vant"]

function createExternalMatcher(packages: string[]) {
  return (id: string) =>
    packages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`))
}

function workspaceSourceAlias() {
  const sourceRoots = [
    {
      marker: normalize(resolve(__dirname, "src")),
      root: resolve(__dirname, "src"),
    },
    {
      marker: normalize(resolve(__dirname, "../vue/src")),
      root: resolve(__dirname, "../vue/src"),
    },
    {
      marker: normalize(resolve(__dirname, "../core/src")),
      root: resolve(__dirname, "../core/src"),
    },
  ]

  return {
    name: "workspace-source-alias",
    enforce: "pre" as const,
    async resolveId(id: string, importer?: string) {
      if (!id.startsWith("@/")) return null

      const normalizedImporter = importer ? normalize(importer) : ""
      const sourceRoot =
        sourceRoots.find(({ marker }) => normalizedImporter.startsWith(marker))
          ?.root ?? resolve(__dirname, "src")
      const absoluteId = resolve(sourceRoot, id.slice(2))

      return this.resolve(absoluteId, importer, { skipSelf: true })
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname, "")
  // VITE_USE_SOURCE 仅用于 dev 热更新（引用源码）；build 一律走外部依赖产物
  const useSource = command === "serve" && env.VITE_USE_SOURCE === "true"
  const analyze = env.VITE_ANALYZE === "true"
  const standalone = env.VITE_BUILD_STANDALONE === "true"
  const entryName = standalone ? "standalone" : "index"
  const isExternal = createExternalMatcher(
    standalone ? standaloneExternalPackages : externalPackages
  )

  return {
    resolve: {
      alias: {
        ...(useSource || standalone
          ? {
              "@schemx/core": resolve(__dirname, "../core/src/index.ts"),
              "@schemx/vue": resolve(__dirname, "../vue/src/index.ts"),
            }
          : {}),
      },
    },
    plugins: [
      workspaceSourceAlias(),
      vue(),
      vueJsx(),
      injectStyleCss(),
      !standalone &&
        dts({
          include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
          outDir: "dist",
          tsconfigPath: "tsconfig.build.json",
          rollupTypes: true,
        }),
      analyze &&
        visualizer({
          filename: resolve(__dirname, "dist/analyze.html"),
          gzipSize: true,
          brotliSize: true,
          open: false,
          template: "treemap",
          title: "@schemx/vant bundle analysis",
        }),
    ].filter(Boolean),
    build: {
      lib: {
        entry: resolve(__dirname, `src/${entryName}.ts`),
        name: "schemxVant",
        formats: ["es", "cjs"],
        fileName: (format) => {
          if (format === "es") return `${entryName}.mjs`
          return `${entryName}.cjs`
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
