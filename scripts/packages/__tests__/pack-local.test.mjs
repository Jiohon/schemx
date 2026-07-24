import { describe, expect, test } from "vitest"

import { parsePackOutput } from "../pack-local.mjs"

describe("pack-local", () => {
  test("解析完整的 pnpm pack JSON 输出", () => {
    expect(parsePackOutput('[{"filename":"schemx-core.tgz"}]', {
      packageName: "@schemx/core",
    })).toEqual({ filename: "schemx-core.tgz" })
  })

  test("拒绝已截断的机器可读输出", () => {
    expect(() => parsePackOutput('[{"filename":"schemx-core.tgz"}]', {
      packageName: "@schemx/core",
      truncated: true,
    })).toThrow("@schemx/core 的机器可读输出已截断，无法安全解析")
  })
})
