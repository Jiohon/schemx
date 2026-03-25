/**
 * isShallowEqual 单元测试
 *
 * 覆盖浅比较的所有分支：相同属性值、不同属性值、
 * 属性数量不同、相同引用、嵌套对象引用、空对象、函数引用。
 *
 * @module utils/__tests__/equal
 */
import { describe, expect, it } from "vitest"

import { isShallowEqual } from "../equal"

describe("isShallowEqual", () => {
  it("属性值相同的对象返回 true", () => {
    expect(isShallowEqual({ a: 1, b: "hello" }, { a: 1, b: "hello" })).toBe(true)
  })

  it("属性值不同的对象返回 false", () => {
    expect(isShallowEqual({ a: 1 }, { a: 2 })).toBe(false)
  })

  it("属性数量不同返回 false", () => {
    expect(isShallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(isShallowEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false)
  })

  it("相同引用的属性返回 true", () => {
    const ref = { nested: true }
    expect(isShallowEqual({ a: ref }, { a: ref })).toBe(true)
  })

  it("不同引用但值相等的嵌套对象返回 false（浅比较特性）", () => {
    expect(isShallowEqual({ a: { x: 1 } }, { a: { x: 1 } })).toBe(false)
  })

  it("两个空对象返回 true", () => {
    expect(isShallowEqual({}, {})).toBe(true)
  })

  it("函数引用通过 === 判断", () => {
    const fn = () => {}

    expect(isShallowEqual({ handler: fn }, { handler: fn })).toBe(true)

    const fn2 = () => {}

    expect(isShallowEqual({ handler: fn }, { handler: fn2 })).toBe(false)
  })
})
