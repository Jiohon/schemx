/**
 * defaultRules 单元测试
 *
 * 覆盖 createRequiredRule 工厂函数的所有分支：
 * undefined、null、空字符串、有效值、数字 0、布尔 false。
 *
 * @module core/validator/__tests__/defaultRules
 */

import { describe, expect, it } from "vitest"

import { createRequiredRule } from "../defaultRules"

describe("createRequiredRule", () => {
  const schema = createRequiredRule({ label: "用户名" } as any)

  it("符合 StandardSchemaV1 接口", () => {
    expect(schema["~standard"]).toBeDefined()
    expect(schema["~standard"].version).toBe(1)
    expect(schema["~standard"].vendor).toBe("schemx")
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
    const schema2 = createRequiredRule({ label: "邮箱" } as any)
    const result = schema2["~standard"].validate("")
    expect(result).toEqual({ issues: [{ message: "请输入邮箱" }] })
  })
})

import { createSelectRequiredRule, createUploadRequiredRule } from "../defaultRules"

describe("createRequiredRule — 无 label 通用提示", () => {
  const schema = createRequiredRule()

  it("无 label 时错误信息为通用提示", () => {
    const result = schema["~standard"].validate("")
    expect(result).toEqual({ issues: [{ message: "此项为必填项" }] })
  })
})

describe("createSelectRequiredRule", () => {
  const schema = createSelectRequiredRule({ label: "城市" } as any)

  it("符合 StandardSchemaV1 接口", () => {
    expect(schema["~standard"].version).toBe(1)
    expect(schema["~standard"].vendor).toBe("schemx")
  })

  it("undefined 校验失败", () => {
    const result = schema["~standard"].validate(undefined)
    expect(result).toEqual({ issues: [{ message: "请选择城市" }] })
  })

  it("null 校验失败", () => {
    const result = schema["~standard"].validate(null)
    expect(result).toEqual({ issues: [{ message: "请选择城市" }] })
  })

  it("空字符串校验失败", () => {
    const result = schema["~standard"].validate("")
    expect(result).toEqual({ issues: [{ message: "请选择城市" }] })
  })

  it("空数组校验失败", () => {
    const result = schema["~standard"].validate([])
    expect(result).toEqual({ issues: [{ message: "请选择城市" }] })
  })

  it("非空值校验通过", () => {
    expect(schema["~standard"].validate("beijing")).toEqual({ value: "beijing" })
  })

  it("非空数组校验通过", () => {
    expect(schema["~standard"].validate([1, 2])).toEqual({ value: [1, 2] })
  })

  it("无 label 时使用通用提示", () => {
    const s = createSelectRequiredRule()
    expect(s["~standard"].validate("")).toEqual({ issues: [{ message: "此项为必选项" }] })
  })
})

describe("createUploadRequiredRule", () => {
  const schema = createUploadRequiredRule({ label: "文件" } as any)

  it("符合 StandardSchemaV1 接口", () => {
    expect(schema["~standard"].version).toBe(1)
    expect(schema["~standard"].vendor).toBe("schemx")
  })

  it("undefined 校验失败", () => {
    const result = schema["~standard"].validate(undefined)
    expect(result).toEqual({ issues: [{ message: "请上传文件" }] })
  })

  it("null 校验失败", () => {
    const result = schema["~standard"].validate(null)
    expect(result).toEqual({ issues: [{ message: "请上传文件" }] })
  })

  it("空数组校验失败", () => {
    const result = schema["~standard"].validate([])
    expect(result).toEqual({ issues: [{ message: "请上传文件" }] })
  })

  it("非空数组校验通过", () => {
    const file = { name: "test.pdf" }
    expect(schema["~standard"].validate([file])).toEqual({ value: [file] })
  })

  it("无 label 时使用通用提示", () => {
    const s = createUploadRequiredRule()
    expect(s["~standard"].validate(undefined)).toEqual({
      issues: [{ message: "此项为必传项" }],
    })
  })
})
