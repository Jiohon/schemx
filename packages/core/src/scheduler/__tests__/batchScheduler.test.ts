/**
 * createBatchScheduler 单元测试
 *
 * 验证微任务批量调度器的核心行为：
 * - 多次 batch 合并为一次 flush
 * - dedupKey 去重（同 key 只保留最后一次）
 * - 手动 flush / clear / size / dispose
 * - flush 后再次 batch 开启新一轮调度
 */
import { describe, expect, it, vi } from "vitest"

import { createBatchScheduler } from ".."

describe("createBatchScheduler", () => {
  it("多次 batch 在 microtask 中合并为一次 flush", async () => {
    const flushFn = vi.fn()
    const scheduler = createBatchScheduler<string>({ flush: flushFn })

    scheduler.batch("a")
    scheduler.batch("b")
    scheduler.batch("c")

    expect(flushFn).not.toHaveBeenCalled()

    await Promise.resolve()

    expect(flushFn).toHaveBeenCalledTimes(1)
    expect(flushFn).toHaveBeenCalledWith(["a", "b", "c"])
  })

  it("dedupKey 去重，同 key 只保留最后一次", async () => {
    const flushFn = vi.fn()
    const scheduler = createBatchScheduler<{ name: string; value: number }>({
      flush: flushFn,
      dedupKey: (t) => t.name,
    })

    scheduler.batch({ name: "x", value: 1 })
    scheduler.batch({ name: "y", value: 2 })
    scheduler.batch({ name: "x", value: 3 })

    await Promise.resolve()

    expect(flushFn).toHaveBeenCalledTimes(1)
    const tasks = flushFn.mock.calls[0][0]
    expect(tasks).toHaveLength(2)
    expect(tasks).toContainEqual({ name: "x", value: 3 })
    expect(tasks).toContainEqual({ name: "y", value: 2 })
  })

  it("手动 flush 立即执行并清空队列", async () => {
    const flushFn = vi.fn()
    const scheduler = createBatchScheduler<string>({ flush: flushFn })

    scheduler.batch("a")
    scheduler.batch("b")

    scheduler.flush()

    expect(flushFn).toHaveBeenCalledTimes(1)
    expect(flushFn).toHaveBeenCalledWith(["a", "b"])

    // microtask 不应再次触发
    await Promise.resolve()
    expect(flushFn).toHaveBeenCalledTimes(1)
  })

  it("flush 后再次 batch 开启新一轮调度", async () => {
    const flushFn = vi.fn()
    const scheduler = createBatchScheduler<string>({ flush: flushFn })

    scheduler.batch("a")
    await Promise.resolve()

    expect(flushFn).toHaveBeenCalledTimes(1)
    expect(flushFn).toHaveBeenCalledWith(["a"])

    scheduler.batch("b")
    scheduler.batch("c")
    await Promise.resolve()

    expect(flushFn).toHaveBeenCalledTimes(2)
    expect(flushFn).toHaveBeenLastCalledWith(["b", "c"])
  })

  it("空队列手动 flush 不调用 flushFn", () => {
    const flushFn = vi.fn()
    const scheduler = createBatchScheduler<string>({ flush: flushFn })

    scheduler.flush()
    expect(flushFn).not.toHaveBeenCalled()
  })

  it("flush 回调内 batch 不丢失任务", async () => {
    const results: string[][] = []
    const scheduler = createBatchScheduler<string>({
      flush: (tasks) => {
        results.push(tasks)
        if (tasks.includes("a")) {
          scheduler.batch("d")
        }
      },
    })

    scheduler.batch("a")
    scheduler.batch("b")

    await Promise.resolve()

    expect(results[0]).toEqual(["a", "b"])

    // flush 内 batch 的 "d" 应在下一轮 microtask 中 flush
    await Promise.resolve()

    expect(results).toHaveLength(2)
    expect(results[1]).toEqual(["d"])
  })

  it("size 返回当前待处理任务数（无去重）", () => {
    const scheduler = createBatchScheduler<string>({ flush: vi.fn() })

    expect(scheduler.size()).toBe(0)

    scheduler.batch("a")
    scheduler.batch("b")
    expect(scheduler.size()).toBe(2)

    scheduler.batch("c")
    expect(scheduler.size()).toBe(3)
  })

  it("size 返回当前待处理任务数（有去重）", () => {
    const scheduler = createBatchScheduler<{ name: string; value: number }>({
      flush: vi.fn(),
      dedupKey: (t) => t.name,
    })

    expect(scheduler.size()).toBe(0)

    scheduler.batch({ name: "x", value: 1 })
    scheduler.batch({ name: "y", value: 2 })
    expect(scheduler.size()).toBe(2)

    // 同 key 覆盖，size 不变
    scheduler.batch({ name: "x", value: 3 })
    expect(scheduler.size()).toBe(2)
  })

  it("clear 清空队列但不执行 flush", async () => {
    const flushFn = vi.fn()
    const scheduler = createBatchScheduler<string>({ flush: flushFn })

    scheduler.batch("a")
    scheduler.batch("b")
    expect(scheduler.size()).toBe(2)

    scheduler.clear()
    expect(scheduler.size()).toBe(0)

    // microtask 不应触发 flush
    await Promise.resolve()
    expect(flushFn).not.toHaveBeenCalled()
  })

  it("clear 后可以重新 batch 并正常调度", async () => {
    const flushFn = vi.fn()
    const scheduler = createBatchScheduler<string>({ flush: flushFn })

    scheduler.batch("a")
    scheduler.clear()

    scheduler.batch("b")
    scheduler.batch("c")

    await Promise.resolve()

    expect(flushFn).toHaveBeenCalledTimes(1)
    expect(flushFn).toHaveBeenCalledWith(["b", "c"])
  })

  it("dispose 后 batch 被静默忽略", async () => {
    const flushFn = vi.fn()
    const scheduler = createBatchScheduler<string>({ flush: flushFn })

    scheduler.batch("a")
    scheduler.dispose()

    expect(scheduler.size()).toBe(0)

    // dispose 后 batch 无效
    scheduler.batch("b")
    expect(scheduler.size()).toBe(0)

    await Promise.resolve()
    expect(flushFn).not.toHaveBeenCalled()
  })

  it("dispose 取消已注册的 microtask", async () => {
    const flushFn = vi.fn()
    const scheduler = createBatchScheduler<string>({ flush: flushFn })

    scheduler.batch("a")
    scheduler.batch("b")

    // microtask 已注册但还没执行
    scheduler.dispose()

    await Promise.resolve()
    expect(flushFn).not.toHaveBeenCalled()
  })
})
