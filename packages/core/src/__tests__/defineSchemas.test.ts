import { describe, expect, it } from "vitest"

import { defineSchemas } from "../defineSchemas"

interface TestValues {
  mode: "simple" | "advanced"
  detail?: string
}

describe("defineSchemas", () => {
  it("以零转换方式返回传入的 schema 数组", () => {
    const schemas = defineSchemas<TestValues>([
      {
        name: "mode",
        label: "模式",
        componentType: "input",
      },
      {
        componentType: "dependency",
        to: ["mode"],
        renderer(values) {
          const mode: TestValues["mode"] | undefined = values.mode
          const detail: TestValues["detail"] = values.detail

          if (mode === "advanced") {
            return [
              {
                name: "detail",
                label: detail ?? "详情",
                componentType: "input",
              },
            ]
          }

          return []
        },
      },
    ])

    expect(schemas).toEqual([
      {
        name: "mode",
        label: "模式",
        componentType: "input",
      },
      schemas[1],
    ])
  })
})
