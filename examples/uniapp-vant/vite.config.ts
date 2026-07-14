import { resolve } from "node:path"

import uni from "@dcloudio/vite-plugin-uni"
import { defineConfig, loadEnv } from "vite"

import { createWorkspaceSourcePlugin } from "../../plugins/vite-plugin-workspace-source/src/index"
import { createRealpathFallbackPlugin } from "../../plugins/vite-plugin-realpath-fallback/src/index"

import type { PluginOption, UserConfig } from "vite"

export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, __dirname)
  const useSource = env.VITE_USE_SOURCE === "true"

  const workspaceRoot = resolve(__dirname, "../..")
  const packagesDir = resolve(workspaceRoot, "packages")
  const appRoot = resolve(__dirname, "src")

  const pkgRoots = {
    core: resolve(packagesDir, "core/src"),
    vue: resolve(packagesDir, "vue/src"),
    vant: resolve(packagesDir, "vant/src"),
  }

  console.log("[vite-config]", {
    mode,
    useSource,
    envValue: env.VITE_USE_SOURCE,
    vueSource: resolve(pkgRoots.vue, "index.ts"),
  })

  const plugins: PluginOption[] = []

  if (useSource) {
    plugins.push(
      createWorkspaceSourcePlugin({
        appRoot,
        workspaceRoot,

        packageRoots: {
          "@schemx/core": pkgRoots.core,
          "@schemx/vue": pkgRoots.vue,
          "@schemx/vant": pkgRoots.vant,
        },
      })
    )
  } else {
    plugins.push(
      createRealpathFallbackPlugin({
        include: [
          "@preact/signals-core",
          "es-toolkit",
          "@vant/use",
          "vant",
          "dayjs",
          "classnames",
        ],

        debug: true,
      })
    )
  }

  plugins.push(uni())

  return {
    resolve: {
      /**
       * 源码模式由 workspace 插件设为 false；
       * 安装包模式需要保留 node_modules 中的符号链接路径。
       */
      preserveSymlinks: true,

      dedupe: [
        "vue",
        "@vue/runtime-core",
        "@vue/runtime-dom",
        "@vue/reactivity",
        "@vue/shared",
      ],
    },

    /**
     * 普通安装包模式：
     *
     * 1. @schemx 包不整体进入 esbuild 预构建，否则其依赖可能因
     *    preserveSymlinks 找不到；
     * 2. classnames、dayjs 是 CommonJS，单独进行预构建转换。
     */
    optimizeDeps: useSource
      ? {
          exclude: ["@schemx/core", "@schemx/vue", "@schemx/vant"],
        }
      : {
          exclude: ["@schemx/core", "@schemx/vue", "@schemx/vant", "classnames"],

          // include: [
          //   "@schemx/vue > classnames",
          //   "@schemx/vant > classnames",
          //   "@schemx/vant > dayjs",
          // ],
        },

    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler",
          silenceDeprecations: ["legacy-js-api"],
        },
      },
    },

    plugins,

    server: {
      host: "0.0.0.0",
    },
  }
})
