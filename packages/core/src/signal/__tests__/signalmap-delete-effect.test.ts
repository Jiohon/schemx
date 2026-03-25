/**
 * SignalMap.delete 后 effect 依赖追踪测试
 *
 * 验证 delete 移除 Signal 后，依赖该 Signal 的 effect 能正确重新执行，
 * 且后续对同一 key 的 set 能被 effect 感知。
 */
import { effect } from "@preact/signals-core"
import { describe, expect, it } from "vitest"

import { SignalMap } from ".."

describe("SignalMap delete 后 effect 追踪", () => {
  it("set → effect 追踪 Signal → delete → effect 应重新执行", () => {
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

    // delete → effect 应重新执行，lastValue 变为 undefined
    map.delete("field")

    expect(effectCount).toBeGreaterThan(1)
    expect(lastValue).toBeUndefined()

    dispose()
  })

  it("set → effect 追踪 Signal → delete → 再 set → effect 应追踪新 Signal", () => {
    const map = new SignalMap<string, string[]>()

    map.set("field", ["v1"])

    let effectCount = 0
    let lastValue: string[] | undefined

    const dispose = effect(() => {
      lastValue = map.get("field")
      effectCount++
    })

    expect(effectCount).toBe(1)
    expect(lastValue).toEqual(["v1"])

    map.delete("field")
    expect(lastValue).toBeUndefined()

    const countBeforeReSet = effectCount
    map.set("field", ["v2"])
    expect(effectCount).toBeGreaterThan(countBeforeReSet)
    expect(lastValue).toEqual(["v2"])

    // 更新已有 key 也应正常追踪
    const countBeforeUpdate = effectCount
    map.set("field", ["v3"])
    expect(effectCount).toBe(countBeforeUpdate + 1)
    expect(lastValue).toEqual(["v3"])

    dispose()
  })

  it("delete 不存在的 key 应静默忽略", () => {
    const map = new SignalMap<string, string[]>()

    let effectCount = 0

    const dispose = effect(() => {
      map.get("nonexistent")
      effectCount++
    })

    expect(effectCount).toBe(1)

    // delete 不存在的 key 不应触发 effect
    map.delete("nonexistent")
    expect(effectCount).toBe(1)

    dispose()
  })
})
