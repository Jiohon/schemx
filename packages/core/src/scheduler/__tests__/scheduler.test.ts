import { describe, expect, it, vi } from "vitest"

import { createRuntimeScheduler } from "../scheduler"

describe("createRuntimeScheduler", () => {
  it("按 channel phase 顺序刷新同一批任务", async () => {
    const scheduler = createRuntimeScheduler()
    const order: string[] = []

    scheduler.queue({
      channel: "dependency",
      key: "main",
      run: () => order.push("dependency"),
    })
    scheduler.queue({
      channel: "dependencies",
      key: "pre",
      run: () => order.push("dependencies"),
    })
    scheduler.queue({
      channel: "validation",
      key: "validation",
      run: () => order.push("validation"),
    })
    scheduler.queue({
      channel: "renderer",
      key: "renderer",
      run: () => order.push("renderer"),
    })
    scheduler.queue({
      channel: "cleanup",
      key: "cleanup",
      run: () => order.push("cleanup"),
    })

    await scheduler.flush()

    expect(order).toEqual([
      "dependencies",
      "dependency",
      "validation",
      "renderer",
      "cleanup",
    ])
  })

  it("同一 channel 和 key 只保留最后一次任务", async () => {
    const scheduler = createRuntimeScheduler()
    const run = vi.fn()

    scheduler.queue({
      channel: "dependency",
      key: "user",
      run: () => run("first"),
    })
    scheduler.queue({
      channel: "dependency",
      key: "user",
      run: () => run("second"),
    })
    scheduler.queue({
      channel: "validation",
      key: "user",
      run: () => run("other-channel"),
    })

    await scheduler.flush()

    expect(run).toHaveBeenCalledTimes(2)
    expect(run).toHaveBeenNthCalledWith(1, "second")
    expect(run).toHaveBeenNthCalledWith(2, "other-channel")
  })

  it("刷新期间新加入的任务进入下一轮 batch boundary", async () => {
    const scheduler = createRuntimeScheduler()
    const order: string[] = []
    let resolveFirst!: () => void
    let resolveNext!: () => void

    scheduler.queue({
      channel: "dependency",
      key: "first",
      run: () => {
        order.push("first")
        scheduler.queue({
          channel: "dependencies",
          key: "next",
          run: () =>
            new Promise<void>((resolve) => {
              order.push("next")
              resolveNext = resolve
            }),
        })

        return new Promise<void>((resolve) => {
          resolveFirst = resolve
        })
      },
    })
    scheduler.queue({
      channel: "validation",
      key: "post",
      run: () => order.push("post"),
    })

    const flushing = scheduler.flush()

    await Promise.resolve()

    expect(order).toEqual(["first"])

    resolveFirst()
    await flushing

    expect(order).toEqual(["first", "post", "next"])
    expect(scheduler.isIdle()).toBe(false)

    resolveNext()
    await scheduler.whenIdle()

    expect(scheduler.isIdle()).toBe(true)
  })

  it("刷新结束后会自动执行下一轮排队任务", async () => {
    const scheduler = createRuntimeScheduler()
    const order: string[] = []

    scheduler.queue({
      channel: "dependency",
      key: "first",
      run: () => {
        order.push("first")
        scheduler.queue({
          channel: "dependencies",
          key: "next",
          run: () => order.push("next"),
        })
      },
    })

    await scheduler.whenIdle()

    expect(order).toEqual(["first", "next"])
    expect(scheduler.isIdle()).toBe(true)
  })

  it("dispose 后视为空闲，whenIdle 立即返回 false", async () => {
    const scheduler = createRuntimeScheduler()
    const run = vi.fn()

    scheduler.queue({ channel: "dependency", key: "job", run })
    scheduler.dispose()

    await Promise.resolve()

    expect(run).not.toHaveBeenCalled()
    expect(scheduler.isIdle()).toBe(true)
    await expect(scheduler.whenIdle()).resolves.toBe(false)
  })

  it("异步任务执行期间保持非 idle，并在完成后唤醒 whenIdle", async () => {
    const scheduler = createRuntimeScheduler()
    let resolveJob!: () => void

    scheduler.queue({
      channel: "dependency",
      key: "async",
      run: () =>
        new Promise<void>((resolve) => {
          resolveJob = resolve
        }),
    })

    const idle = scheduler.whenIdle()
    const flushing = scheduler.flush()

    await Promise.resolve()

    expect(scheduler.isIdle()).toBe(false)

    resolveJob()
    await flushing

    await expect(idle).resolves.toBe(true)
    expect(scheduler.isIdle()).toBe(true)
  })
})
