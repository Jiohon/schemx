import { describe, expect, test } from "vitest"

import * as asyncValidatorEntry from "../async-validator"
import * as validatorPackage from "../index"
import * as presetEntry from "../preset"
import * as zodEntry from "../zod"

describe("@schemx/validator 入口边界", () => {
  test("根入口不加载可选 peer，运行时 adapter 由各子路径提供", () => {
    expect(Object.keys(validatorPackage)).toEqual([])
    expect(zodEntry).toMatchObject({ createZodAdapter: expect.any(Function) })
    expect(asyncValidatorEntry).toMatchObject({
      createAsyncValidatorAdapter: expect.any(Function),
    })
    expect(presetEntry).toMatchObject({
      createValidationAdapterPreset: expect.any(Function),
    })
  })

  test("各入口可创建对应 adapter 或预设", () => {
    expect(zodEntry.createZodAdapter()).toMatchObject({
      id: "zod",
      rule: expect.any(Function),
      isRule: expect.any(Function),
      resolve: expect.any(Function),
    })
    expect(presetEntry.createValidationAdapterPreset()).toMatchObject({
      adapters: [expect.any(Object), expect.any(Object)],
    })
  })
})
