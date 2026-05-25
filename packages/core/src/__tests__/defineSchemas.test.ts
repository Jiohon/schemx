import { describe, expect, it } from "vitest"

import { defineSchemas } from "../defineSchemas"

interface TestValues {
  mode: "simple" | "advanced"
  detail?: string
}

describe("defineSchemas", () => {
  it("以零转换方式返回创建的 schema 数组", () => {
    const schema = defineSchemas<TestValues>()

    const field = schema.field({
      name: "mode",
      label: "模式",
      componentType: "input",
    })

    const dependency = schema.dependency({
      componentType: "dependency",
      to: ["mode"],
      renderer(values) {
        if (values.mode === "advanced") {
          return [
            {
              name: "detail",
              label: "详情",
              componentType: "input",
            },
          ]
        }

        return []
      },
    })

    const schemas = schema([field, dependency])

    expect(schemas).toEqual([field, dependency])
    expect(schemas[1]).toBe(dependency)
  })
})
