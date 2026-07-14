import { describe, expect, test } from "vitest"

import * as vuePackage from "../index"

describe("@schemx/vue 根入口", () => {
  test("导出上下文创建与 ViewSchemas 桥接 API", () => {
    expect(vuePackage).toMatchObject({
      createFieldContext: expect.any(Function),
      createFormConfigContext: expect.any(Function),
      createFormContext: expect.any(Function),
      useStableRef: expect.any(Function),
      useViewSchemas: expect.any(Function),
    })
  })
})
