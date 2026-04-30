/**
 * resolvePropertyCondition 属性测试
 *
 * 使用 fast-check 对 {@link resolvePropertyCondition} 进行基于属性的测试，
 * 验证其输出满足设计文档中定义的正确性属性。
 *
 * @module utils/__tests__/dependency
 */

import { describe, it, expect, vi, beforeAll } from "vitest"
import * as fc from "fast-check"

describe("resolvePropertyCondition", () => {
  let resolvePropertyCondition: typeof import("../dependency").resolvePropertyCondition

  beforeAll(async () => {
    const mod = await import("../dependency")
    resolvePropertyCondition = mod.resolvePropertyCondition
  })

  it("同步条件函数返回非 nullish 值时直接使用", async () => {
    const result = await resolvePropertyCondition(() => true, { province: "广东" }, false)
    expect(result).toBe(true)
  })

  it("同步条件函数返回 false 时不回退到默认值", async () => {
    const result = await resolvePropertyCondition(() => false, {}, true)
    expect(result).toBe(false)
  })

  it("同步条件函数返回 0 时不回退到默认值", async () => {
    const result = await resolvePropertyCondition(() => 0, {}, 42)
    expect(result).toBe(0)
  })

  it("同步条件函数返回空字符串时不回退到默认值", async () => {
    const result = await resolvePropertyCondition(() => "", {}, "default")
    expect(result).toBe("")
  })

  it("条件函数接收 formValues 参数", async () => {
    const result = await resolvePropertyCondition(
      (values) => `选择${values.province}的城市`,
      { province: "广东" },
      "默认"
    )
    expect(result).toBe("选择广东的城市")
  })

  it("返回 null 时使用默认值", async () => {
    const result = await resolvePropertyCondition(
      () => null as unknown as string,
      {},
      "fallback"
    )
    expect(result).toBe("fallback")
  })

  it("返回 undefined 时使用默认值", async () => {
    const result = await resolvePropertyCondition(
      () => undefined as unknown as boolean,
      {},
      true
    )
    expect(result).toBe(true)
  })

  it("异步条件函数正常解析", async () => {
    const result = await resolvePropertyCondition(
      async () => "async-value",
      {},
      "default"
    )
    expect(result).toBe("async-value")
  })

  it("异步条件函数返回 null 时使用默认值", async () => {
    const result = await resolvePropertyCondition(
      async () => null as unknown as string,
      {},
      "fallback"
    )
    expect(result).toBe("fallback")
  })

  it("同步异常时捕获错误并回退到默认值", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const result = await resolvePropertyCondition(
      () => {
        throw new Error("sync boom")
      },
      {},
      "safe"
    )

    expect(result).toBe("safe")
    expect(consoleSpy).toHaveBeenCalledWith(
      "[schemx] 解析动态属性时发生错误:",
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })

  it("异步异常时捕获错误并回退到默认值", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const result = await resolvePropertyCondition(
      async () => {
        throw new Error("async boom")
      },
      {},
      false
    )

    expect(result).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith(
      "[schemx] 解析动态属性时发生错误:",
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })
})

describe("resolvePropertyCondition - Property Tests", () => {
  let resolvePropertyCondition: typeof import("../dependency").resolvePropertyCondition

  beforeAll(async () => {
    const mod = await import("../dependency")
    resolvePropertyCondition = mod.resolvePropertyCondition
  })

  // Feature: dependencies-object-refactor, Property 5: 条件函数结果直接生效
  it("Property 5: 非 nullish 返回值直接作为解析结果", () => {
    const nonNullishArb = fc.oneof(
      fc.string(),
      fc.integer(),
      fc.double({ noNaN: true }),
      fc.boolean(),
      fc.constant(0),
      fc.constant(""),
      fc.constant(false),
      fc.record({ key: fc.string() })
    )

    return fc.assert(
      fc.asyncProperty(nonNullishArb, async (value) => {
        const result = await resolvePropertyCondition(() => value, {}, "__default__")
        expect(result).toEqual(value)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: dependencies-object-refactor, Property 5: nullish 回退
  it("Property 5: nullish 返回值时回退到默认值", () => {
    const nullishArb = fc.constantFrom(null, undefined)
    const defaultArb = fc.oneof(fc.string({ minLength: 1 }), fc.integer(), fc.boolean())

    return fc.assert(
      fc.asyncProperty(nullishArb, defaultArb, async (nullish, defaultVal) => {
        const result = await resolvePropertyCondition(
          () => nullish as unknown,
          {},
          defaultVal
        )
        expect(result).toEqual(defaultVal)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: dependencies-object-refactor, Property 6: 错误韧性
  it("Property 6: 异常时回退到默认值并记录日志", () => {
    const defaultArb = fc.oneof(fc.string(), fc.integer(), fc.boolean())

    return fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        defaultArb,
        async (msg, defaultVal) => {
          const spy = vi.spyOn(console, "error").mockImplementation(() => {})

          try {
            const result = await resolvePropertyCondition(
              () => {
                throw new Error(msg)
              },
              {},
              defaultVal
            )
            expect(result).toEqual(defaultVal)
            expect(spy).toHaveBeenCalledWith(
              "[schemx] 解析动态属性时发生错误:",
              expect.any(Error)
            )
          } finally {
            spy.mockRestore()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: dependencies-object-refactor, Property 7: 异步解析支持
  it("Property 7: 同步和异步条件函数结果一致", () => {
    const nonNullishArb = fc.oneof(
      fc.string(),
      fc.integer(),
      fc.boolean(),
      fc.constant(0),
      fc.constant("")
    )

    return fc.assert(
      fc.asyncProperty(nonNullishArb, async (value) => {
        const syncResult = await resolvePropertyCondition(() => value, {}, "__default__")
        const asyncResult = await resolvePropertyCondition(
          async () => value,
          {},
          "__default__"
        )
        expect(asyncResult).toEqual(syncResult)
      }),
      { numRuns: 100 }
    )
  })
})
