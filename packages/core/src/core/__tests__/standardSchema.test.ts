/**
 * StandardSchema 单元测试
 *
 * 覆盖 createRequiredSchema 工厂函数的所有分支：
 * undefined、null、空字符串、有效值、数字 0、布尔 false。
 *
 * @module core/__tests__/standardSchema
 */

import { describe, expect, it } from "vitest"

import { createRequiredSchema } from "../../utils/standardSchema"

describe("createRequiredSchema", () => {
  const schema = createRequiredSchema({ label: "用户名" } as any)

  it("符合 StandardSchemaV1 接口", () => {
    expect(schema["~standard"]).toBeDefined()
    expect(schema["~standard"].version).toBe(1)
    expect(schema["~standard"].vendor).toBe("vue-schema-form")
    expect(typeof schema["~standard"].validate).toBe("function")
  })

  it("undefined 校验失败", () => {
    const result = schema["~standard"].validate(undefined)
    expect(result).toEqual({ issues: [{ message: "请输入用户名" }] })
  })

  it("null 校验失败", () => {
    const result = schema["~standard"].validate(null)
    expect(result).toEqual({ issues: [{ message: "请输入用户名" }] })
  })

  it("空字符串校验失败", () => {
    const result = schema["~standard"].validate("")
    expect(result).toEqual({ issues: [{ message: "请输入用户名" }] })
  })

  it("非空字符串校验通过", () => {
    const result = schema["~standard"].validate("hello")
    expect(result).toEqual({ value: "hello" })
  })

  it("数字 0 校验通过（0 不是空值）", () => {
    const result = schema["~standard"].validate(0)
    expect(result).toEqual({ value: 0 })
  })

  it("布尔 false 校验通过（false 不是空值）", () => {
    const result = schema["~standard"].validate(false)
    expect(result).toEqual({ value: false })
  })

  it("对象校验通过", () => {
    const obj = { key: "value" }
    const result = schema["~standard"].validate(obj)
    expect(result).toEqual({ value: obj })
  })

  it("不同 label 生成不同提示", () => {
    const schema2 = createRequiredSchema({ label: "邮箱" } as any)
    const result = schema2["~standard"].validate("")
    expect(result).toEqual({ issues: [{ message: "请输入邮箱" }] })
  })
})
