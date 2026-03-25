/**
 * resolveDynamicProp 动态属性解析单元测试
 *
 * 覆盖静态值、同步函数、异步函数、null/undefined 回退、
 * 函数返回 nullish 回退、函数抛异常回退。
 *
 * @module utils/__tests__/dynamic
 */
import { describe, expect, it, vi } from "vitest"

import { resolveDynamicProp } from "../dynamic"

const formValues = { name: "test", age: 25 }

describe("resolveDynamicProp", () => {
  it("静态值直接返回", async () => {
    expect(await resolveDynamicProp("hello", formValues, "default")).toBe("hello")
    expect(await resolveDynamicProp(42, formValues, 0)).toBe(42)
    expect(await resolveDynamicProp(false, formValues, true)).toBe(false)
  })

  it("同步函数被调用并传入 formValues", async () => {
    const fn = (v: any) => v.name
    expect(await resolveDynamicProp(fn, formValues, "default")).toBe("test")
  })

  it("异步函数等待 Promise 解析", async () => {
    const fn = async (v: any) => v.age
    expect(await resolveDynamicProp(fn, formValues, 0)).toBe(25)
  })

  it("null 返回默认值", async () => {
    expect(await resolveDynamicProp(null, formValues, "default")).toBe("default")
  })

  it("undefined 返回默认值", async () => {
    expect(await resolveDynamicProp(undefined, formValues, "default")).toBe("default")
  })

  it("函数返回 null 回退到默认值", async () => {
    const fn = () => null as any
    expect(await resolveDynamicProp(fn, formValues, "fallback")).toBe("fallback")
  })

  it("函数返回 undefined 回退到默认值", async () => {
    const fn = () => undefined as any
    expect(await resolveDynamicProp(fn, formValues, "fallback")).toBe("fallback")
  })

  it("函数抛异常捕获错误并返回默认值", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const fn = () => {
      throw new Error("boom")
    }

    expect(await resolveDynamicProp(fn, formValues, "safe")).toBe("safe")
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
