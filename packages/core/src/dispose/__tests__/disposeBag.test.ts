import { describe, expect, it, vi } from "vitest"

import { createDisposeBag } from "../disposeBag"

describe("createDisposeBag", () => {
  it("按 phase 顺序释放，同 phase 内 LIFO，并且 flush 幂等", () => {
    const bag = createDisposeBag()
    const order: string[] = []

    bag.add(() => order.push("main:first"))
    bag.add(() => order.push("main:second"))
    bag.add(() => order.push("pre:first"), "pre")
    bag.add(() => order.push("post:first"), "post")

    bag.flush()
    bag.flush()

    expect(order).toEqual(["pre:first", "main:second", "main:first", "post:first"])
    expect(bag.flushed).toBe(true)
  })

  it("已 flush 后新增 cleanup 会立即执行", () => {
    const bag = createDisposeBag()
    const dispose = vi.fn()

    bag.flush()
    bag.add(dispose)

    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it("onDispose 支持取消注册", () => {
    const bag = createDisposeBag()
    const dispose = vi.fn()

    const subscription = bag.onDispose(dispose)
    subscription.unsubscribe()
    bag.flush()

    expect(dispose).not.toHaveBeenCalled()
  })

  it("单个 cleanup 抛错不影响后续 cleanup 执行", () => {
    const bag = createDisposeBag()
    const cleanup = vi.fn()

    bag.add(cleanup)
    bag.add(() => {
      throw new Error("boom")
    })

    expect(() => bag.flush()).toThrow("boom")
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
