/**
 * SignalMap.clear 后 effect 依赖追踪测试
 *
 * 验证 clear 清空所有 Signal 后，依赖已删除 key 的 effect 能正确重新执行，
 * 且后续对同一 key 的 set 能被 effect 感知。
 */
import { describe, it, expect } from "vitest"
import { effect } from "@preact/signals-core"
import { SignalMap } from ".."

describe("SignalMap clear 后 effect 追踪", () => {
  it("set → effect 追踪 Signal → clear → effect 应重新执行", () => {
    const map = new SignalMap<string, string[]>()

    map.set("field", ["initial"])

    let effectCount = 0
    let lastValue: string[] | undefined

    const dispose = effect(() => {
      lastValue = map.get("field")
      effectCount++
    })

    expect(effectCount).toBe(1)
    expect(lastValue).toEqual(["initial"])

    map.clear()

    expect(effectCount).toBeGreaterThan(1)
    expect(lastValue).toBeUndefined()

    // 再 set 应该能追踪
    const countBefore = effectCount
    map.set("field", ["v2"])
    expect(effectCount).toBeGreaterThan(countBefore)
    expect(lastValue).toEqual(["v2"])

    dispose()
  })

  it("多个 key 的 effect 在 clear 后都应重新执行", () => {
    const map = new SignalMap<string, number>()

    map.set("a", 1)
    map.set("b", 2)

    let lastA: number | undefined
    let lastB: number | undefined

    const disposeA = effect(() => {
      lastA = map.get("a")
    })
    const disposeB = effect(() => {
      lastB = map.get("b")
    })

    expect(lastA).toBe(1)
    expect(lastB).toBe(2)

    map.clear()

    expect(lastA).toBeUndefined()
    expect(lastB).toBeUndefined()

    disposeA()
    disposeB()
  })

  it("空 map 调用 clear 不应触发 effect", () => {
    const map = new SignalMap<string, number>()

    let effectCount = 0

    const dispose = effect(() => {
      map.get("any")
      effectCount++
    })

    expect(effectCount).toBe(1)

    map.clear()
    expect(effectCount).toBe(1)

    dispose()
  })
})
