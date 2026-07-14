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

/**
 * Node 内置模块名称集合。
 *
 * 同时包含：
 *
 * - fs
 * - path
 * - node:fs
 * - node:path
 */
const builtinPackageNames = new Set<string>([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
])

/**
 * 判断 source 是否是裸包导入。
 *
 * 裸包导入示例：
 *
 * ```ts
 * import "vue"
 * import "es-toolkit"
 * import "@babel/parser"
 * import "foo/subpath"
 * ```
 *
 * 以下内容不属于裸包导入：
 *
 * ```ts
 * import "./utils"
 * import "../shared"
 * import "/absolute/path"
 * import "node:fs"
 * import "virtual:module"
 * ```
 *
 * @param source 模块导入标识。
 * @returns 是否为裸包导入。
 */
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

/**
 * 从裸包导入 ID 中提取 npm 包名。
 *
 * @example
 * ```ts
 * getPackageName("vue")
 * // => "vue"
 *
 * getPackageName("vue/dist/vue.runtime.esm-bundler.js")
 * // => "vue"
 *
 * getPackageName("@vue/runtime-core")
 * // => "@vue/runtime-core"
 *
 * getPackageName("@vue/runtime-core/dist/runtime-core.esm-bundler.js")
 * // => "@vue/runtime-core"
 * ```
 *
 * @param source 模块导入标识。
 * @returns npm 包名，无法提取时返回 null。
 */
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

/**
 * 将 Windows 路径统一转换为正斜杠路径。
 *
 * @param filename 文件路径。
 * @returns 标准化后的路径。
 */
function normalizePath(filename: string): string {
  return filename.replaceAll("\\", "/")
}

/**
 * 移除 Vite 模块 ID 中的查询参数和 hash。
 *
 * @example
 * ```ts
 * cleanModuleId(
 *   "/src/App.vue?vue&type=script&lang.ts",
 * )
 * // => "/src/App.vue"
 * ```
 *
 * @param id Vite 模块 ID。
 * @returns 不包含 query 和 hash 的模块 ID。
 */
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

/**
 * 将 importer 转换为可供文件系统 API 使用的绝对路径。
 *
 * 支持：
 *
 * - 普通绝对路径；
 * - file:// URL；
 * - 带 Vite query 的文件路径。
 *
 * 不支持：
 *
 * - 虚拟模块；
 * - 相对路径；
 * - 非文件协议 URL。
 *
 * @param importer 导入模块 ID。
 * @returns 文件系统绝对路径，无法转换时返回 null。
 */
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

/**
 * 判断 importer 是否属于指定 npm 包。
 *
 * 同时支持普通 node_modules 结构和 pnpm 的虚拟目录结构。
 *
 * 普通结构：
 *
 * ```text
 * node_modules/@schemx/vant/src/index.ts
 * ```
 *
 * pnpm 结构：
 *
 * ```text
 * node_modules/.pnpm/@schemx+vant@1.0.0/node_modules/@schemx/vant/src/index.ts
 * ```
 *
 * 两种结构的后半部分都包含：
 *
 * ```text
 * /node_modules/@schemx/vant/
 * ```
 *
 * @param importer importer 文件路径。
 * @param packageName npm 包名。
 * @returns importer 是否属于该包。
 */
function importerBelongsToPackage(importer: string, packageName: string): boolean {
  const normalizedImporter = normalizePath(cleanModuleId(importer))

  const normalizedPackageName = normalizePath(packageName)

  const packageSegment = `/node_modules/${normalizedPackageName}/`

  return normalizedImporter.includes(packageSegment)
}

/**
 * 判断 importer 是否匹配指定包集合。
 *
 * @param importer importer 文件路径。
 * @param packageNames npm 包名集合。
 * @returns 是否匹配集合中的任意包。
 */
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

/**
 * 格式化插件调试日志。
 *
 * @param title 日志标题。
 * @param fields 日志字段。
 * @returns 多行日志文本。
 */
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

  /**
   * importer 逻辑路径到真实路径的缓存。
   *
   * Vite 开发服务器中同一个 importer 会参与大量模块解析，
   * 缓存可以避免重复访问文件系统。
   */
  const realpathCache = new Map<string, string | null>()

  let resolvedConfig: ResolvedConfig | undefined

  /**
   * 获取文件的真实路径。
   *
   * 获取失败的结果也会缓存，避免对不存在或不可访问的 importer
   * 重复执行文件系统操作。
   *
   * @param filename 文件路径。
   * @returns 真实路径，获取失败时返回 null。
   */
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

  /**
   * 判断 source 是否允许进入 fallback 流程。
   *
   * @param source 被导入模块 ID。
   * @returns 是否允许 fallback。
   */
  function isSourceAllowed(source: string): boolean {
    if (!isBareImport(source)) {
      return false
    }

    const packageName = getPackageName(source)

    if (!packageName) {
      return false
    }

    if (builtinPackageNames.has(source) || builtinPackageNames.has(packageName)) {
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

  /**
   * 判断 importer 是否允许进入 fallback 流程。
   *
   * @param importer 发起导入的模块 ID。
   * @returns 是否允许 fallback。
   */
  function isImporterAllowed(importer: string): boolean {
    if (
      excludedImporters.size > 0 &&
      importerMatchesAnyPackage(importer, excludedImporters)
    ) {
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

  /**
   * 判断当前解析请求是否允许进入插件流程。
   *
   * @param source 被导入模块 ID。
   * @param importer 发起导入的模块 ID。
   * @returns 是否允许处理。
   */
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

    const message = formatDebugMessage(
      "[realpath-fallback] resolve completed",
      { status, ...fields }
    )
    const succeeded =
      status === "standard-resolved" || status === "fallback-resolved"

    resolvedConfig.logger[succeeded ? "info" : "warn"](message)
  }

  return {
    name: "vite:realpath-fallback",

    /**
     * 让插件优先进入 resolveId。
     *
     * 插件进入后会通过 `this.resolve(..., { skipSelf: true })`
     * 委托给其余插件和 Vite 内部解析器处理。
     */
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

      /**
       * 第一阶段：使用原始逻辑 importer 执行标准解析。
       *
       * skipSelf=true 非常重要，它可以防止 this.resolve()
       * 再次进入当前插件，避免无限递归。
       */
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

      /**
       * 第二阶段：把 importer 转换为文件系统路径。
       *
       * Vue SFC importer 可能包含：
       *
       * ```text
       * App.vue?vue&type=script&lang.ts
       * ```
       *
       * normalizeImporterPath 会移除 query 和 hash。
       */
      const importerPath = normalizeImporterPath(importer)

      if (!importerPath) {
        logResolveResult("invalid-importer", {
          source,
          importer,
        })

        return null
      }

      /**
       * 第三阶段：获取 importer 的真实路径。
       */
      const realImporter = getRealpath(importerPath)

      if (!realImporter) {
        logResolveResult("realpath-failed", {
          source,
          importer,
          importerPath,
        })

        return null
      }

      /**
       * 真实路径与逻辑路径相同时，说明 importer 本身没有经过
       * 符号链接路径访问，不需要再次解析。
       */
      if (normalizePath(realImporter) === normalizePath(importerPath)) {
        logResolveResult("realpath-unchanged", {
          source,
          importer,
          realImporter,
        })

        return null
      }

      /**
       * 第四阶段：使用真实 importer 重新走完整的 Vite 解析流程。
       *
       * 这里仍然使用 this.resolve，而不是 require.resolve，
       * 以保留 Vite 的 alias、条件导出和其他插件解析能力。
       */
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
