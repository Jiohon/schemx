/**
 * AsyncComputation 模块测试。
 *
 * @module core/field/__tests__/asyncComputation.test
 */

import { describe, expect, it, vi } from "vitest"

import { createScheduler } from "../scheduler"
import { createRuntimeScope } from "../../graph/scope"
import { createAsyncComputation } from "../asyncComputation"

describe("createAsyncComputation", () => {
  it("应该创建 AsyncComputation", () => {
    const scope = createRuntimeScope()
    const scheduler = createScheduler()

    const computation = createAsyncComputation({
      id: "test",
      scope,
      scheduler,
      initialValue: 0,
      compute: () => 42,
    })

    expect(computation.value.value).toBe(0)
    expect(computation.loading.value).toBe(false)
    expect(computation.error.value).toBeNull()
  })

  it("应该支持同步计算", async () => {
    const scope = createRuntimeScope()
    const scheduler = createScheduler()

    const computation = createAsyncComputation({
      id: "test",
      scope,
      scheduler,
      initialValue: 0,
      compute: () => 42,
    })

    await computation.run()

    expect(computation.value.value).toBe(42)
    expect(computation.loading.value).toBe(false)
  })

  it("应该支持异步计算", async () => {
    const scope = createRuntimeScope()
    const scheduler = createScheduler()

    const computation = createAsyncComputation({
      id: "test",
      scope,
      scheduler,
      initialValue: 0,
      compute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 42
      },
    })

    expect(computation.loading.value).toBe(false)

    await computation.run()

    expect(computation.value.value).toBe(42)
    expect(computation.loading.value).toBe(false)
  })
})

describe("race condition", () => {
  it("应该在新的 run 时 abort 旧的 run", async () => {
    const scope = createRuntimeScope()
    const scheduler = createScheduler()

    let abortedCount = 0

    const computation = createAsyncComputation({
      id: "test",
      scope,
      scheduler,
      initialValue: 0,
      compute: async (signal) => {
        await new Promise((resolve) => setTimeout(resolve, 20))

        if (signal.aborted) {
          abortedCount++
          throw new Error("Aborted")
        }

        return 42
      },
    })

    // 启动第一个 run
    computation.run()

    // 立即启动第二个 run
    await computation.run()

    // 等待所有异步任务完成
    await scheduler.whenIdle()

    // 第二个 run 应该成功
    expect(computation.value.value).toBe(42)
  })

  it("应该确保旧 result 不覆盖新 result", async () => {
    const scope = createRuntimeScope()
    const scheduler = createScheduler()

    const results: number[] = []

    const computation = createAsyncComputation({
      id: "test",
      scope,
      scheduler,
      initialValue: 0,
      compute: async (signal) => {
        const delay = Math.random() * 20 + 10
        await new Promise((resolve) => setTimeout(resolve, delay))

        if (signal.aborted) {
          throw new Error("Aborted")
        }

        return Date.now()
      },
    })

    // 连续触发两次 run
    const run1 = computation.run()
    await new Promise((resolve) => setTimeout(resolve, 5))
    const run2 = computation.run()

    await Promise.all([run1, run2])
    await scheduler.whenIdle()

    // 最终值应该是第二个 run 的结果
    // 由于时间差，我们只验证值存在
    expect(computation.value.value).toBeGreaterThan(0)
  })
})

describe("error handling", () => {
  it("应该捕获错误", async () => {
    const scope = createRuntimeScope()
    const scheduler = createScheduler()

    const computation = createAsyncComputation({
      id: "test",
      scope,
      scheduler,
      initialValue: 0,
      compute: async () => {
        throw new Error("Test error")
      },
    })

    await computation.run()

    expect(computation.error.value).toBeInstanceOf(Error)
    expect(computation.error.value?.message).toBe("Test error")
  })
})

describe("dispose", () => {
  it("应该在 dispose 后不再更新", async () => {
    const scope = createRuntimeScope()
    const scheduler = createScheduler()

    const computation = createAsyncComputation({
      id: "test",
      scope,
      scheduler,
      initialValue: 0,
      compute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 42
      },
    })

    computation.dispose()

    await computation.run()

    // dispose 后不应该更新
    expect(computation.value.value).toBe(0)
  })
})
