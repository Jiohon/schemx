import fs from "node:fs"
import { builtinModules } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type { Plugin, ResolvedConfig } from "vite"

/**
 * 符号链接 importer fallback 插件配置。
 */
export interface RealpathFallbackPluginOptions {
  /**
   * 允许使用 fallback 的被导入包。
   *
   * 配置的是 source 对应的包名，而不是 importer 所属的包名。
   *
   * @example
   * ```ts
   * createRealpathFallbackPlugin({
   *   include: [
   *     "es-toolkit",
   *     "magic-string",
   *     "@babel/parser",
   *   ],
   * })
   * ```
   *
   * 当为空数组或未配置时，允许所有裸包导入进入 fallback 流程。
   */
  include?: string[]

  /**
   * 禁止使用 fallback 的包。
   *
   * Vue、React、Pinia 等具有实例身份或全局状态的包，
   * 通常应放入 exclude，并通过 Vite 的 resolve.dedupe 保证单例。
   *
   * @example
   * ```ts
   * createRealpathFallbackPlugin({
   *   exclude: [
   *     "vue",
   *     "pinia",
   *     "vue-router",
   *   ],
   * })
   * ```
   */
  exclude?: string[]

  /**
   * 只允许指定包内部发起的导入进入 fallback。
   *
   * 配置的是 importer 所属的包名。
   *
   * @example
   * ```ts
   * createRealpathFallbackPlugin({
   *   includeImporters: [
   *     "@schemx/vant",
   *     "@dcloudio/uni-app",
   *   ],
   * })
   * ```
   *
   * 当为空数组或未配置时，不限制 importer 所属包。
   */
  includeImporters?: string[]

  /**
   * 排除指定包内部发起的导入。
   *
   * 配置的是 importer 所属的包名。
   */
  excludeImporters?: string[]

  /**
   * 是否输出解析调试日志。
   *
   * @default false
   */
  debug?: boolean

  /**
   * 是否输出每次受理解析请求的详细结果。
   *
   * 成功与失败结果都会输出。
   *
   * @default false
   */
  detailedLog?: boolean
}

type ResolveResultStatus =
  | "standard-resolved"
  | "fallback-resolved"
  | "invalid-importer"
  | "realpath-failed"
  | "realpath-unchanged"
  | "fallback-failed"

const builtinPackageNames = new Set<string>([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
])

function isBareImport(source: string): boolean {
  if (!source) {
    return false
  }

  return (
    !source.startsWith(".") &&
    !source.startsWith("/") &&
    !source.startsWith("\\") &&
    !source.startsWith("\0") &&
    !source.startsWith("data:") &&
    !source.startsWith("http:") &&
    !source.startsWith("https:") &&
    !source.startsWith("file:")
  )
}

function getPackageName(source: string): string | null {
  if (!source) {
    return null
  }

  if (source.startsWith("@")) {
    const segments = source.split("/")

    if (segments.length < 2 || !segments[0] || !segments[1]) {
      return null
    }

    return `${segments[0]}/${segments[1]}`
  }

  const packageName = source.split("/")[0]

  return packageName || null
}

function normalizePath(filename: string): string {
  return filename.replaceAll("\\", "/")
}

function cleanModuleId(id: string): string {
  const queryIndex = id.indexOf("?")
  const hashIndex = id.indexOf("#")

  let endIndex = id.length

  if (queryIndex >= 0) {
    endIndex = Math.min(endIndex, queryIndex)
  }

  if (hashIndex >= 0) {
    endIndex = Math.min(endIndex, hashIndex)
  }

  return id.slice(0, endIndex)
}

function normalizeImporterPath(importer: string): string | null {
  const cleanedImporter = cleanModuleId(importer)

  if (!cleanedImporter || cleanedImporter.startsWith("\0")) {
    return null
  }

  if (cleanedImporter.startsWith("file://")) {
    try {
      return fileURLToPath(cleanedImporter)
    } catch {
      return null
    }
  }

  if (!path.isAbsolute(cleanedImporter)) {
    return null
  }

  return cleanedImporter
}

function importerBelongsToPackage(importer: string, packageName: string): boolean {
  const normalizedImporter = normalizePath(cleanModuleId(importer))

  const normalizedPackageName = normalizePath(packageName)

  const packageSegment = `/node_modules/${normalizedPackageName}/`

  return normalizedImporter.includes(packageSegment)
}

function importerMatchesAnyPackage(
  importer: string,
  packageNames: ReadonlySet<string>
): boolean {
  for (const packageName of packageNames) {
    if (importerBelongsToPackage(importer, packageName)) {
      return true
    }
  }

  return false
}

function formatDebugMessage(
  title: string,
  fields: Record<string, string | number | boolean | null | undefined>
): string {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined)

  const maxKeyLength = entries.reduce(
    (maxLength, [key]) => Math.max(maxLength, key.length),
    0
  )

  const lines = entries.map(([key, value]) => {
    const paddedKey = key.padEnd(maxKeyLength, " ")

    return `  ${paddedKey}: ${String(value)}`
  })

  return [title, ...lines].join("\n")
}

/**
 * 创建 pnpm 符号链接 importer fallback Vite 插件。
 *
 * 当 `resolve.preserveSymlinks=true` 时，Vite 会保留模块的符号链接
 * 逻辑路径。例如：
 *
 * ```text
 * /app/node_modules/foo/index.js
 * ```
 *
 * 但 pnpm 为 foo 构建的真实依赖环境位于：
 *
 * ```text
 * /app/node_modules/.pnpm/foo@1.0.0/node_modules/foo/index.js
 * ```
 *
 * foo 内部导入 bar 时，基于逻辑路径可能无法找到：
 *
 * ```text
 * /app/node_modules/.pnpm/foo@1.0.0/node_modules/bar
 * ```
 *
 * 该插件会按以下顺序处理：
 *
 * 1. 使用原始逻辑 importer 执行标准 Vite 解析；
 * 2. 标准解析失败后，获取 importer 的真实路径；
 * 3. 使用真实 importer 再执行一次完整的 Vite 解析；
 * 4. fallback 仍然失败时返回 null，由 Vite 正常报告错误。
 *
 * 插件不会直接使用 `require.resolve()`，而是调用 Vite 插件上下文的
 * `this.resolve()`，因此可以继续支持：
 *
 * - alias；
 * - package.json exports；
 * - browser/import 条件；
 * - 其他 Vite 插件；
 * - SSR 解析参数；
 * - external 与 moduleSideEffects 等 Rollup 元数据。
 *
 * @param options 插件配置。
 * @returns Vite 插件。
 *
 * @example
 * ```ts
 * import { defineConfig } from "vite"
 *
 * import { createRealpathFallbackPlugin } from "./realpath-fallback"
 *
 * export default defineConfig({
 *   resolve: {
 *     preserveSymlinks: true,
 *     dedupe: [
 *       "vue",
 *       "pinia",
 *       "vue-router",
 *     ],
 *   },
 *
 *   plugins: [
 *     createRealpathFallbackPlugin({
 *       includeImporters: [
 *         "@schemx/vant",
 *       ],
 *
 *       exclude: [
 *         "vue",
 *         "pinia",
 *         "vue-router",
 *       ],
 *
 *       debug:
 *         process.env.DEBUG_RESOLVE === "1",
 *     }),
 *   ],
 * })
 * ```
 */
export function createRealpathFallbackPlugin(
  options: RealpathFallbackPluginOptions = {}
): Plugin {
  const includedPackages = new Set(options.include ?? [])
  const excludedPackages = new Set(options.exclude ?? [])
  const includedImporters = new Set(options.includeImporters ?? [])
  const excludedImporters = new Set(options.excludeImporters ?? [])

  const realpathCache = new Map<string, string | null>()

  let resolvedConfig: ResolvedConfig | undefined

  function getRealpath(filename: string): string | null {
    if (realpathCache.has(filename)) {
      return realpathCache.get(filename) ?? null
    }

    try {
      const realpath = fs.realpathSync.native(filename)

      realpathCache.set(filename, realpath)

      return realpath
    } catch {
      realpathCache.set(filename, null)

      return null
    }
  }

  function isSourceAllowed(source: string): boolean {
    if (!isBareImport(source)) {
      return false
    }

    const packageName = getPackageName(source)

    if (!packageName) {
      return false
    }

    if (builtinPackageNames.has(packageName)) {
      return false
    }

    if (excludedPackages.has(packageName)) {
      return false
    }

    if (includedPackages.size > 0 && !includedPackages.has(packageName)) {
      return false
    }

    return true
  }

  function isImporterAllowed(importer: string): boolean {
    if (importerMatchesAnyPackage(importer, excludedImporters)) {
      return false
    }

    if (
      includedImporters.size > 0 &&
      !importerMatchesAnyPackage(importer, includedImporters)
    ) {
      return false
    }

    return true
  }

  function shouldHandle(source: string, importer: string): boolean {
    return isSourceAllowed(source) && isImporterAllowed(importer)
  }

  function logResolveResult(
    status: ResolveResultStatus,
    fields: Record<string, string | undefined>
  ): void {
    if (!options.detailedLog || !resolvedConfig) {
      return
    }

    const message = formatDebugMessage("[realpath-fallback] resolve completed", {
      status,
      ...fields,
    })
    const succeeded = status === "standard-resolved" || status === "fallback-resolved"

    resolvedConfig.logger[succeeded ? "info" : "warn"](message)
  }

  return {
    name: "vite:realpath-fallback",

    enforce: "pre",

    configResolved(config) {
      resolvedConfig = config

      if (options.debug && !config.resolve.preserveSymlinks) {
        config.logger.warn(
          [
            "[realpath-fallback]",
            "resolve.preserveSymlinks=false，",
            "当前插件通常没有启用的必要。",
          ].join("")
        )
      }

      if (options.debug) {
        config.logger.info(
          formatDebugMessage("[realpath-fallback] initialized", {
            preserveSymlinks: config.resolve.preserveSymlinks,
            includedPackages:
              includedPackages.size > 0 ? [...includedPackages].join(", ") : "*",
            excludedPackages: [...excludedPackages].join(", "),
            includedImporters:
              includedImporters.size > 0 ? [...includedImporters].join(", ") : "*",
            excludedImporters:
              excludedImporters.size > 0 ? [...excludedImporters].join(", ") : "-",
          })
        )
      }
    },

    async resolveId(source, importer, resolveOptions) {
      if (!importer) {
        return null
      }

      if (!shouldHandle(source, importer)) {
        return null
      }

      // 避免 this.resolve 再次进入当前插件。
      const standardResolved = await this.resolve(source, importer, {
        ...resolveOptions,
        skipSelf: true,
      })

      if (standardResolved) {
        logResolveResult("standard-resolved", {
          source,
          importer,
          resolved: standardResolved.id,
        })

        return standardResolved
      }

      const importerPath = normalizeImporterPath(importer)

      if (!importerPath) {
        logResolveResult("invalid-importer", {
          source,
          importer,
        })

        return null
      }

      const realImporter = getRealpath(importerPath)

      if (!realImporter) {
        logResolveResult("realpath-failed", {
          source,
          importer,
          importerPath,
        })

        return null
      }

      if (normalizePath(realImporter) === normalizePath(importerPath)) {
        logResolveResult("realpath-unchanged", {
          source,
          importer,
          realImporter,
        })

        return null
      }

      const fallbackResolved = await this.resolve(source, realImporter, {
        ...resolveOptions,
        skipSelf: true,
      })

      if (!fallbackResolved) {
        logResolveResult("fallback-failed", {
          source,
          importer,
          realImporter,
        })

        return null
      }

      logResolveResult("fallback-resolved", {
        source,
        importer,
        realImporter,
        resolved: fallbackResolved.id,
      })

      return fallbackResolved
    },

    buildEnd() {
      realpathCache.clear()
    },
  }
}
