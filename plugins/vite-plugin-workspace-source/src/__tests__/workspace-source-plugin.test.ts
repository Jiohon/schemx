import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, test } from "vitest"

import * as pluginModule from "../index"

describe("createWorkspaceSourcePlugin", () => {
  test("提供 createWorkspaceSourcePlugin 工厂函数", () => {
    expect(pluginModule.createWorkspaceSourcePlugin).toBeTypeOf("function")
  })

  test("将精确匹配的 workspace 包名解析到源码入口", async () => {
    const coreRoot = path.resolve("packages/core/src")
    const plugins = pluginModule.createWorkspaceSourcePlugin({
      appRoot: path.resolve("examples/uniapp-vant/src"),
      workspaceRoot: path.resolve("."),
      packageRoots: {
        "@schemx/core": coreRoot,
      },
    })
    const plugin = plugins[0]

    if (!plugin || typeof plugin.resolveId !== "function") {
      throw new Error("Missing resolveId hook")
    }

    const resolved = await plugin.resolveId.call(
      {} as never,
      "@schemx/core",
      path.resolve("examples/uniapp-vant/src/main.ts"),
      {} as never
    )

    expect(resolved).toBe(path.join(coreRoot, "index.ts"))
  })

  test("提供源码模式所需的文件访问和单例配置", async () => {
    const workspaceRoot = path.resolve(".")
    const plugins = pluginModule.createWorkspaceSourcePlugin({
      appRoot: path.resolve("examples/uniapp-vant/src"),
      workspaceRoot,
      packageRoots: {
        "@schemx/core": path.resolve("packages/core/src"),
      },
    })
    const plugin = plugins[0]

    if (!plugin?.config) {
      throw new Error("Missing config hook")
    }

    const configHandler =
      typeof plugin.config === "function" ? plugin.config : plugin.config.handler
    const config = await configHandler.call({} as never, {}, {} as never)

    expect(config).toEqual({
      resolve: {
        alias: [
          {
            customResolver: expect.any(Function),
            find: /^@\//,
            replacement: "@/",
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
    })
    expect(plugin.config).toMatchObject({ order: "post" })
  })

  test("组合 Vue JSX 源码转换", () => {
    const plugins = pluginModule.createWorkspaceSourcePlugin({
      appRoot: path.resolve("examples/uniapp-vant/src"),
      workspaceRoot: path.resolve("."),
      packageRoots: {
        "@schemx/vue": path.resolve("packages/vue/src"),
      },
    })

    const jsxPlugin = plugins.find((plugin) => plugin.name === "vite:vue-jsx")

    expect(jsxPlugin?.config).toMatchObject({ order: "post" })
  })

  test("动态 alias 委托 Vite 完成目录入口解析", async () => {
    const vantRoot = path.resolve("packages/vant/src")
    const plugins = pluginModule.createWorkspaceSourcePlugin({
      appRoot: path.resolve("examples/uniapp-vant/src"),
      workspaceRoot: path.resolve("."),
      packageRoots: {
        "@schemx/vant": vantRoot,
      },
    })
    const plugin = plugins[0]

    if (!plugin?.config) {
      throw new Error("Missing config hook")
    }

    const configHandler =
      typeof plugin.config === "function" ? plugin.config : plugin.config.handler
    const config = await configHandler.call({} as never, {}, {} as never)
    const alias = Array.isArray(config?.resolve?.alias)
      ? config.resolve.alias[0]
      : undefined

    if (!alias || typeof alias === "string" || !alias.customResolver) {
      throw new Error("Missing dynamic alias resolver")
    }

    const resolveCalls: string[] = []
    const resolvedEntry = path.join(vantRoot, "utils/index.ts")
    const context = {
      resolve: async (source: string) => {
        resolveCalls.push(source)

        return { id: resolvedEntry }
      },
    }
    const customResolver =
      typeof alias.customResolver === "function"
        ? alias.customResolver
        : alias.customResolver.resolveId
    const resolved = await customResolver.call(
      context as never,
      "@/utils",
      path.join(vantRoot, "components/Cell/index.vue?vue&type=script"),
      {} as never
    )

    expect(resolveCalls).toEqual([path.join(vantRoot, "utils")])
    expect(resolved).toEqual({ id: resolvedEntry })
  })
})

describe("createWorkspaceTypeFileSystem", () => {
  test("只把普通文件报告为可读文件", () => {
    const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-type-fs-"))
    const typeDirectory = path.join(appRoot, "types")
    const typeFile = path.join(typeDirectory, "index.ts")

    fs.mkdirSync(typeDirectory)
    fs.writeFileSync(typeFile, "export interface Props {}")

    try {
      const typeFs = pluginModule.createWorkspaceTypeFileSystem({ appRoot })

      expect(typeFs.fileExists(typeDirectory)).toBe(false)
      expect(typeFs.readFile(typeDirectory)).toBeUndefined()
      expect(typeFs.fileExists(typeFile)).toBe(true)
      expect(typeFs.readFile(typeFile)).toBe("export interface Props {}")
    } finally {
      fs.rmSync(appRoot, { force: true, recursive: true })
    }
  })

  test("解析应用 alias 并转换读取到的源码", () => {
    const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-type-fs-"))
    const typeFile = path.join(appRoot, "types.ts")
    const transformedFiles: string[] = []

    fs.writeFileSync(typeFile, "original")

    try {
      const typeFs = pluginModule.createWorkspaceTypeFileSystem({
        appRoot,
        transform(source, filename) {
          transformedFiles.push(filename)

          return `${source}:transformed`
        },
      })

      expect(typeFs.readFile("@/types.ts")).toBe("original:transformed")
      expect(transformedFiles).toEqual([typeFile])
      expect(typeFs.realpath("@/types.ts")).toBe(fs.realpathSync(typeFile))
    } finally {
      fs.rmSync(appRoot, { force: true, recursive: true })
    }
  })
})
