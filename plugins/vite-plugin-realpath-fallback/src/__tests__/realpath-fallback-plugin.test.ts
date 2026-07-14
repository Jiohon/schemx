import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, test } from "vitest"

import * as pluginModule from "../index"

import type { Plugin } from "vite"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true })
  }
})

function createSymlinkFixture() {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "schemx-realpath-fallback-")
  )
  temporaryDirectories.push(temporaryDirectory)

  const realPackage = path.join(temporaryDirectory, "store/package")
  const logicalPackage = path.join(temporaryDirectory, "node_modules/package")
  const realImporter = path.join(realPackage, "index.mjs")
  const logicalImporter = path.join(logicalPackage, "index.mjs")

  fs.mkdirSync(realPackage, { recursive: true })
  fs.mkdirSync(path.dirname(logicalPackage), { recursive: true })
  fs.writeFileSync(realImporter, "export {}\n")
  fs.symlinkSync(realPackage, logicalPackage, "dir")

  return {
    logicalImporter,
    normalizedRealImporter: fs.realpathSync.native(logicalImporter),
    temporaryDirectory,
  }
}

function configurePlugin(plugin: Plugin) {
  const infoMessages: string[] = []
  const warnMessages: string[] = []

  if (typeof plugin.configResolved !== "function") {
    throw new Error("Missing configResolved hook")
  }

  plugin.configResolved.call({} as never, {
    logger: {
      info: (message: string) => infoMessages.push(message),
      warn: (message: string) => warnMessages.push(message),
    },
    resolve: { preserveSymlinks: true },
  } as never)

  return { infoMessages, warnMessages }
}

async function callResolve(
  plugin: Plugin,
  resolve: (source: string, importer: string) => Promise<{ id: string } | null>,
  importer = "/app/node_modules/package/index.mjs"
) {
  if (typeof plugin.resolveId !== "function") {
    throw new Error("Missing resolveId hook")
  }

  return plugin.resolveId.call(
    { resolve } as never,
    "dependency",
    importer,
    {} as never
  )
}

describe("createRealpathFallbackPlugin", () => {
  test("提供 createRealpathFallbackPlugin 工厂函数", () => {
    expect(pluginModule.createRealpathFallbackPlugin).toBeTypeOf("function")
  })

  test("标准解析失败后使用 importer realpath 重试", async () => {
    const { logicalImporter, normalizedRealImporter, temporaryDirectory } =
      createSymlinkFixture()

    const plugin = pluginModule.createRealpathFallbackPlugin({
      include: ["dependency"],
    })

    if (typeof plugin.resolveId !== "function") {
      throw new Error("Missing resolveId hook")
    }

    const resolveCalls: string[] = []
    const expectedResolution = path.join(temporaryDirectory, "store/dependency/index.mjs")
    const context = {
      resolve: async (_source: string, importer: string) => {
        resolveCalls.push(importer)

        return importer === normalizedRealImporter ? { id: expectedResolution } : null
      },
    }

    const resolved = await plugin.resolveId.call(
      context as never,
      "dependency",
      logicalImporter,
      {} as never
    )

    expect(resolveCalls).toEqual([logicalImporter, normalizedRealImporter])
    expect(resolved).toEqual({ id: expectedResolution })
  })

  test("detailedLog 独立于 debug 输出标准解析成功结果", async () => {
    const plugin = pluginModule.createRealpathFallbackPlugin({
      detailedLog: true,
      include: ["dependency"],
    })
    const { infoMessages, warnMessages } = configurePlugin(plugin)
    const expectedResolution = { id: "/resolved/dependency.mjs" }

    const resolved = await callResolve(plugin, async () => expectedResolution)

    expect(resolved).toEqual(expectedResolution)
    expect(infoMessages).toHaveLength(1)
    expect(infoMessages[0]).toContain("status  : standard-resolved")
    expect(warnMessages).toEqual([])
  })

  test("未开启 detailedLog 时不输出逐请求结果", async () => {
    const plugin = pluginModule.createRealpathFallbackPlugin({
      include: ["dependency"],
    })
    const { infoMessages, warnMessages } = configurePlugin(plugin)

    await callResolve(plugin, async () => ({ id: "/resolved/dependency.mjs" }))

    expect(infoMessages).toEqual([])
    expect(warnMessages).toEqual([])
  })

  test("fallback 成功时输出真实 importer 和解析结果", async () => {
    const { logicalImporter, normalizedRealImporter, temporaryDirectory } =
      createSymlinkFixture()
    const expectedResolution = path.join(
      temporaryDirectory,
      "store/dependency/index.mjs"
    )
    const plugin = pluginModule.createRealpathFallbackPlugin({
      detailedLog: true,
      include: ["dependency"],
    })
    const { infoMessages, warnMessages } = configurePlugin(plugin)

    await callResolve(
      plugin,
      async (_source, importer) =>
        importer === normalizedRealImporter ? { id: expectedResolution } : null,
      logicalImporter
    )

    expect(infoMessages).toHaveLength(1)
    expect(infoMessages[0]).toContain("status      : fallback-resolved")
    expect(infoMessages[0]).toContain(
      `realImporter: ${normalizedRealImporter}`
    )
    expect(infoMessages[0]).toContain(`resolved    : ${expectedResolution}`)
    expect(warnMessages).toEqual([])
  })

  test("fallback 失败时仍输出详细结果", async () => {
    const { logicalImporter, normalizedRealImporter } = createSymlinkFixture()
    const plugin = pluginModule.createRealpathFallbackPlugin({
      detailedLog: true,
      include: ["dependency"],
    })
    const { infoMessages, warnMessages } = configurePlugin(plugin)

    const resolved = await callResolve(plugin, async () => null, logicalImporter)

    expect(resolved).toBeNull()
    expect(infoMessages).toEqual([])
    expect(warnMessages).toHaveLength(1)
    expect(warnMessages[0]).toContain("status      : fallback-failed")
    expect(warnMessages[0]).toContain(
      `realImporter: ${normalizedRealImporter}`
    )
  })

  test("真实路径未变化时输出详细结果", async () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(
        fs.realpathSync.native(os.tmpdir()),
        "schemx-realpath-fallback-"
      )
    )
    temporaryDirectories.push(temporaryDirectory)
    const importer = path.join(temporaryDirectory, "package/index.mjs")
    fs.mkdirSync(path.dirname(importer), { recursive: true })
    fs.writeFileSync(importer, "export {}\n")

    const plugin = pluginModule.createRealpathFallbackPlugin({
      detailedLog: true,
      include: ["dependency"],
    })
    const { infoMessages, warnMessages } = configurePlugin(plugin)

    const resolved = await callResolve(plugin, async () => null, importer)

    expect(resolved).toBeNull()
    expect(infoMessages).toEqual([])
    expect(warnMessages).toHaveLength(1)
    expect(warnMessages[0]).toContain("status      : realpath-unchanged")
  })
})
