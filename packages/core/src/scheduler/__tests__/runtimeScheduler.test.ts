import { describe, expect, it, vi } from "vitest"

import { createRuntimeScheduler } from "../runtimeScheduler"

describe("createRuntimeScheduler", () => {
  it("按 pre/main/post 顺序刷新同一批任务", async () => {
    const scheduler = createRuntimeScheduler()
    const order: string[] = []

    scheduler.enqueue({ type: "dependency", run: () => order.push("main-a") })
    scheduler.enqueue({
      type: "dynamic-prop",
      phase: "pre",
      run: () => order.push("pre"),
    })
    scheduler.enqueue({
      type: "validation",
      phase: "post",
      run: () => order.push("post"),
    })
    scheduler.enqueue({ type: "dependency", run: () => order.push("main-b") })

    await scheduler.flush()

    expect(order).toEqual(["pre", "main-a", "main-b", "post"])
  })

  it("同一 phase 内按 type 和 dedupeKey 去重并保留最后一次任务", async () => {
    const scheduler = createRuntimeScheduler()
    const run = vi.fn()

    scheduler.enqueue({
      type: "dependency",
      dedupeKey: "user",
      run: () => run("first"),
    })
    scheduler.enqueue({
      type: "dependency",
      dedupeKey: "user",
      run: () => run("second"),
    })
    scheduler.enqueue({
      type: "dynamic-prop",
      dedupeKey: "user",
      run: () => run("other-type"),
    })

    await scheduler.flush()

    expect(run).toHaveBeenCalledTimes(2)
    expect(run).toHaveBeenNthCalledWith(1, "second")
    expect(run).toHaveBeenNthCalledWith(2, "other-type")
  })

  it("刷新期间新加入的任务进入下一轮 batch boundary", async () => {
    const scheduler = createRuntimeScheduler()
    const order: string[] = []
    let resolveFirst!: () => void

    scheduler.enqueue({
      type: "dependency",
      run: () => {
        order.push("first")
        scheduler.enqueue({
          type: "dependency",
          phase: "pre",
          run: () => order.push("next-pre"),
        })
        return new Promise<void>((resolve) => {
          resolveFirst = resolve
        })
      },
    })
    scheduler.enqueue({
      type: "validation",
      phase: "post",
      run: () => order.push("post"),
    })

    const flushing = scheduler.flush()

    await Promise.resolve()

    expect(order).toEqual(["first"])
    expect(scheduler.isIdle()).toBe(false)

    resolveFirst()
    await flushing
    await Promise.resolve()

    expect(order).toEqual(["first", "post", "next-pre"])
    expect(scheduler.isIdle()).toBe(true)
  })

  it("异步任务执行期间保持非 idle，并在完成后恢复 idle", async () => {
    const scheduler = createRuntimeScheduler()
    let resolveJob!: () => void

    scheduler.enqueue({
      type: "dependency",
      run: () =>
        new Promise<void>((resolve) => {
          resolveJob = resolve
        }),
    })

    const flushing = scheduler.flush()

    await Promise.resolve()

    expect(scheduler.isIdle()).toBe(false)

    resolveJob()
    await flushing

    expect(scheduler.isIdle()).toBe(true)
  })

  it("dispose 会取消尚未执行的任务", async () => {
    const scheduler = createRuntimeScheduler()
    const run = vi.fn()

    scheduler.enqueue({ type: "dependency", run })
    scheduler.dispose()

    await Promise.resolve()

    expect(run).not.toHaveBeenCalled()
    expect(scheduler.isIdle()).toBe(true)
  })
})
