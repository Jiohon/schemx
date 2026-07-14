import { describe, expect, test } from "vitest"

import { injectStyleCss } from "../index"

interface OutputAsset {
  fileName: string
  names: string[]
  source: string
  type: "asset"
}

interface OutputChunk {
  code: string
  fileName: string
  isEntry: boolean
  type: "chunk"
}

type OutputBundle = Record<string, OutputAsset | OutputChunk>

function createChunk(fileName: string, code: string, isEntry = true): OutputChunk {
  return {
    code,
    fileName,
    isEntry,
    type: "chunk",
  } as OutputChunk
}

function createAsset(fileName: string): OutputAsset {
  return {
    fileName,
    names: [],
    source: "",
    type: "asset",
  }
}

async function generateBundle(bundle: OutputBundle, styleFileName?: string) {
  const plugin = injectStyleCss(styleFileName ? { styleFileName } : {})
  const hook = plugin.generateBundle
  const handler = typeof hook === "function" ? hook : hook?.handler

  if (typeof handler !== "function") {
    throw new Error("Missing generateBundle hook")
  }

  await handler.call({} as never, {} as never, bundle as never, false)
}

describe("injectStyleCss", () => {
  test("在 Vite 生成 CSS asset 后执行", () => {
    const plugin = injectStyleCss()

    expect(plugin.generateBundle).toMatchObject({ order: "post" })
  })

  test("向 ESM entry 注入 CSS asset 的相对路径", async () => {
    const entry = createChunk("chunks/index.mjs", "export const value = 1\n")
    const bundle: OutputBundle = {
      "assets/style.css": createAsset("assets/style.css"),
      "chunks/index.mjs": entry,
    }

    await generateBundle(bundle)

    expect(entry.code).toBe('import "../assets/style.css";\nexport const value = 1\n')
  })

  test("没有目标 CSS asset 时保持 entry 不变", async () => {
    const entry = createChunk("index.mjs", "export const value = 1\n")

    await generateBundle({ "index.mjs": entry })

    expect(entry.code).toBe("export const value = 1\n")
  })

  test("支持自定义 CSS 文件名", async () => {
    const entry = createChunk("index.mjs", "export const value = 1\n")
    const bundle: OutputBundle = {
      "assets/components.css": createAsset("assets/components.css"),
      "index.mjs": entry,
    }

    await generateBundle(bundle, "components.css")

    expect(entry.code).toBe('import "./assets/components.css";\nexport const value = 1\n')
  })

  test("不修改 CommonJS entry", async () => {
    const entry = createChunk("index.cjs", "exports.value = 1\n")
    const bundle: OutputBundle = {
      "index.cjs": entry,
      "style.css": createAsset("style.css"),
    }

    await generateBundle(bundle)

    expect(entry.code).toBe("exports.value = 1\n")
  })

  test("已存在相同 CSS import 时不重复注入", async () => {
    const code = 'import "./style.css";\nexport const value = 1\n'
    const entry = createChunk("index.mjs", code)
    const bundle: OutputBundle = {
      "index.mjs": entry,
      "style.css": createAsset("style.css"),
    }

    await generateBundle(bundle)
    await generateBundle(bundle)

    expect(entry.code).toBe(code)
  })
})
