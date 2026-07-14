import path from "node:path"

import vueJsx from "@vitejs/plugin-vue-jsx"

import type { Plugin } from "vite"

export interface WorkspaceSourcePluginOptions {
  /**
   * 应用源码根目录。
   */
  appRoot: string

  /**
   * workspace 根目录。开发服务器会允许访问该目录中的源码。
   */
  workspaceRoot: string

  /**
   * 包名到源码根目录的映射。精确匹配的包名会解析到源码根目录下的
   * `index.ts`。
   */
  packageRoots: Record<string, string>
}

/**
 * 将 workspace 包名解析到源码入口，并根据 importer 所在目录动态解析
 * `@/`。
 *
 * 普通 Vite alias 是全局规则，无法让不同 workspace 包拥有各自的
 * `@/`。该插件会根据 importer 的实际位置决定 `@/` 指向哪里。
 */
export function createWorkspaceSourcePlugin(
  options: WorkspaceSourcePluginOptions
): Plugin[] {
  const appRoot = path.resolve(options.appRoot)
  const workspaceRoot = path.resolve(options.workspaceRoot)

  const packageRoots = Object.entries(options.packageRoots).map(([name, root]) => ({
    name,
    root: path.resolve(root),
  }))

  function normalizePath(filename: string): string {
    return filename.replaceAll("\\", "/")
  }

  function isInside(filename: string, directory: string): boolean {
    const relative = path.relative(directory, filename)

    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
  }

  function resolveSourceAlias(source: string, importer?: string): string | null {
    if (!importer || !source.startsWith("@/")) {
      return null
    }

    const cleanImporter = importer.replace(/[?#].*$/, "")
    const relativeSource = source.slice(2)

    for (const packageRoot of packageRoots) {
      if (isInside(cleanImporter, packageRoot.root)) {
        return normalizePath(path.resolve(packageRoot.root, relativeSource))
      }
    }

    return normalizePath(path.resolve(appRoot, relativeSource))
  }

  const resolutionPlugin: Plugin = {
    name: "vite:workspace-source",
    enforce: "pre",

    config: {
      order: "post",
      handler() {
        return {
          resolve: {
            alias: [
              {
                find: /^@\//,
                replacement: "@/",
                async customResolver(source, importer, resolveOptions) {
                  const resolvedSource = resolveSourceAlias(source, importer)

                  if (!resolvedSource) {
                    return null
                  }

                  return this.resolve(resolvedSource, importer, {
                    attributes: resolveOptions.attributes,
                    isEntry: resolveOptions.isEntry,
                    skipSelf: true,
                    ...(resolveOptions.custom === undefined
                      ? {}
                      : { custom: resolveOptions.custom }),
                    ...(resolveOptions.importerAttributes === undefined
                      ? {}
                      : { importerAttributes: resolveOptions.importerAttributes }),
                  })
                },
              },
            ],
            dedupe: [
              "vue",
              "@vue/runtime-core",
              "@vue/runtime-dom",
              "@vue/reactivity",
              "@vue/shared",
            ],
            preserveSymlinks: false,
          },
          server: {
            fs: {
              allow: [workspaceRoot],
            },
          },
        }
      },
    },

    resolveId(source, importer) {
      const sourcePackage = packageRoots.find(({ name }) => source === name)

      if (sourcePackage) {
        return normalizePath(path.join(sourcePackage.root, "index.ts"))
      }

      return resolveSourceAlias(source, importer)
    },
  }

  const jsxPlugin = vueJsx()

  if (jsxPlugin.config) {
    const configHandler =
      typeof jsxPlugin.config === "function" ? jsxPlugin.config : jsxPlugin.config.handler

    // uni-app 会在后续 config hook 中重新把 TSX 交给 esbuild 的 TS loader。
    jsxPlugin.config = {
      order: "post",
      handler: configHandler,
    }
  }

  return [resolutionPlugin, jsxPlugin]
}
