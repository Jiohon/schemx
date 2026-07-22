import { describe, expect, test } from "vitest"

import * as vantPackage from "../index"

describe("@schemx/vant 根入口", () => {
  test("导出渲染器公共工具", () => {
    expect(vantPackage).toMatchObject({
      getReadonlyDisplayValue: expect.any(Function),
      isEmptyDisplayValue: expect.any(Function),
      isRendererInteractive: expect.any(Function),
      resolveRendererMode: expect.any(Function),
      validationRuleRegistry: expect.any(Object),
      createValidationRuleRegistry: expect.any(Function),
      ValidationRuleRegistry: expect.any(Function),
      RendererRegistry: expect.any(Function),
    })

    expect(["validator", "Registry"].join("") in vantPackage).toBe(false)
    expect(["create", "Validators", "Registry"].join("") in vantPackage).toBe(false)
  })
})
