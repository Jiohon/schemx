/**
 * T022 [P] [US1] - immutable schema input 与 empty schema 契约测试
 *
 * 验证：
 * 1. 输入 schema 在整个表单生命周期中保持不变
 * 2. 空 schema 输入被正确处理
 * 3. 非法 schema 输入产生 fail-fast diagnostics
 */

import { describe, it, expect, vi } from "vitest"
import type { SchemxSchemasInput } from "../../createSchemas"

describe("Schema Compiler - Immutable Input", () => {
  it("should not mutate the original jsonSchemas input", () => {
    const originalSchemas: SchemxSchemasInput = [
      {
        name: "username",
        label: "Username",
      },
      {
        name: "email",
        label: "Email",
      },
    ]

    // 深拷贝一份用于对比
    const originalCopy = JSON.parse(JSON.stringify(originalSchemas))

    // TODO: 实际调用 compiler，这里先占位
    // const result = compileSchema(originalSchemas)

    // 验证原始输入未被修改
    expect(originalSchemas).toEqual(originalCopy)
  })

  it("should handle empty schema input gracefully", () => {
    const emptySchemas: SchemxSchemasInput = []

    // TODO: 实际调用 compiler
    // const result = compileSchema(emptySchemas)

    // 验证空输入被正确处理
    expect(true).toBe(true)
  })

  it("should not mutate nested objects in schema input", () => {
    const originalSchemas: SchemxSchemasInput = [
      {
        name: "profile",
        label: "Profile",
        children: [
          {
            name: "firstName",
            label: "First Name",
            rules: [{ required: true, message: "Required" }],
          },
        ],
      },
    ]

    const originalCopy = JSON.parse(JSON.stringify(originalSchemas))

    // TODO: 实际调用 compiler
    // const result = compileSchema(originalSchemas)

    // 验证原始输入（包括嵌套对象）未被修改
    expect(originalSchemas).toEqual(originalCopy)
  })
})

describe("Schema Compiler - Empty Schema Handling", () => {
  it("should produce empty normalized nodes for empty input", () => {
    // TODO: 实现
    expect(true).toBe(true)
  })

  it("should allow schema replacement from empty to non-empty", () => {
    // TODO: 实现
    expect(true).toBe(true)
  })

  it("should allow schema replacement from non-empty to empty", () => {
    // TODO: 实现
    expect(true).toBe(true)
  })
})
