import { createRealpathFallbackPlugin } from "@schemx/vite-plugin-realpath-fallback"

import type { Plugin } from "vite"

const defaultDedupe = [
  "vue",
  "@vue/runtime-core",
  "@vue/runtime-dom",
  "@vue/reactivity",
  "@vue/shared",
] as const

export interface PackageResolutionCompatPluginOptions {
  /** 不参与 Vite 依赖预构建、保留到普通解析阶段的安装包。 */
  packages: string[]

  /** 允许使用 importer realpath 重试的依赖包。 */
  fallbackDependencies: string[]

  /** 必须保持单例、禁止 realpath fallback 的依赖包。 */
  dedupe?: string[]

  /** 是否输出 realpath fallback 调试日志。 */
  debug?: boolean
}

/**
 * 创建普通包安装模式的完整 Vite 解析兼容插件组。
 *
 * 该插件组会避开 Vite 的依赖预构建，将目标包交给普通解析管线，
 * 再通过 importer realpath 重试解析 pnpm 虚拟目录中的依赖。
 */
export function createPackageResolutionCompatPlugin(
  options: PackageResolutionCompatPluginOptions
): Plugin[] {
  const dedupe = options.dedupe ?? [...defaultDedupe]

  const configPlugin: Plugin = {
    name: "vite:package-resolution-compat",

    config() {
      return {
        optimizeDeps: {
          exclude: options.packages,
        },
        resolve: {
          dedupe,
          preserveSymlinks: true,
        },
      }
    },
  }

  return [
    configPlugin,
    createRealpathFallbackPlugin({
      include: options.fallbackDependencies,
      exclude: dedupe,
      ...(options.debug === undefined ? {} : { debug: options.debug }),
    }),
  ]
}
