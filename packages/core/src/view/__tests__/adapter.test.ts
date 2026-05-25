/**
 * ViewAdapter 和 createViewAdapterBridge 单元测试。
 *
 * @module core/view/__tests__/adapter.test
 */

import { describe, expect, it, vi } from "vitest"

import { createViewAdapterBridge, validateNamePath } from "../adapter"

import type { ViewAdapter } from "../adapter"

describe("validateNamePath", () => {
  it("应该接受非空字符串", () => {
    expect(validateNamePath("user")).toBe(true)
    expect(validateNamePath("user.name")).toBe(true)
  })

  it("应该拒绝空字符串", () => {
    expect(validateNamePath("")).toBe(false)
  })

  it("应该接受非空字符串数组", () => {
    expect(validateNamePath(["user", "name"])).toBe(true)
  })

  it("应该拒绝空数组", () => {
    expect(validateNamePath([])).toBe(false)
  })

  it("应该拒绝包含非字符串元素的数组", () => {
    expect(validateNamePath(["user", 123])).toBe(false)
  })

  it("应该拒绝非字符串非数组类型", () => {
    expect(validateNamePath(123)).toBe(false)
    expect(validateNamePath(null)).toBe(false)
    expect(validateNamePath({})).toBe(false)
  })
})

describe("createViewAdapterBridge", () => {
  const createMockAdapter = (): ViewAdapter => ({
    render: vi.fn(),
    onFieldValueChange: vi.fn(),
    onFieldTouched: vi.fn(),
  })

  it("render 应该直接转发（包括空数组）", () => {
    const mock = createMockAdapter()
    const bridge = createViewAdapterBridge(mock)

    bridge.render([])
    expect(mock.render).toHaveBeenCalledWith([])

    const tree = [{ id: 1, key: "f1", type: "field" as const, renderer: "input", name: ["f1"], props: { visible: true, readonly: false, disabled: false, required: false, placeholder: "", componentProps: {} }, state: { value: "", touched: false, pending: null, errors: [], validating: false }, children: [] }]
    bridge.render(tree)
    expect(mock.render).toHaveBeenCalledWith(tree)
  })

  it("应该在无效 NamePath 时 onFieldValueChange 抛出 TypeError", () => {
    const mock = createMockAdapter()
    const bridge = createViewAdapterBridge(mock)

    expect(() => bridge.onFieldValueChange("", "value")).toThrow(TypeError)
    expect(() => bridge.onFieldValueChange([], "value")).toThrow(TypeError)
    expect(mock.onFieldValueChange).not.toHaveBeenCalled()
  })

  it("应该在有效 NamePath 时 onFieldValueChange 正常转发", () => {
    const mock = createMockAdapter()
    const bridge = createViewAdapterBridge(mock)

    bridge.onFieldValueChange("username", "Alice")
    expect(mock.onFieldValueChange).toHaveBeenCalledWith("username", "Alice")
  })

  it("应该在无效 NamePath 时 onFieldTouched 抛出 TypeError", () => {
    const mock = createMockAdapter()
    const bridge = createViewAdapterBridge(mock)

    expect(() => bridge.onFieldTouched("")).toThrow(TypeError)
    expect(() => bridge.onFieldTouched([])).toThrow(TypeError)
    expect(mock.onFieldTouched).not.toHaveBeenCalled()
  })

  it("应该在有效 NamePath 时 onFieldTouched 正常转发", () => {
    const mock = createMockAdapter()
    const bridge = createViewAdapterBridge(mock)

    bridge.onFieldTouched(["user", "name"])
    expect(mock.onFieldTouched).toHaveBeenCalledWith(["user", "name"])
  })
})
