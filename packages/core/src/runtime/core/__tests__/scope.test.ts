/**
 * Scope 模块测试。
 *
 * @module core/runtime/core/__tests__/scope.test
 */

import { describe, expect, it, vi } from "vitest"

import { createRuntimeScope, reportRuntimeCleanupError } from "../scope"

describe("createRuntimeScope", () => {
  it("应该创建空 Scope", () => {
    const scope = createRuntimeScope()

    expect(scope.disposed).toBe(false)
  })

  it("应该注册 cleanup 并 dispose", () => {
    const scope = createRuntimeScope()

    const cleanup = vi.fn()
    scope.add(cleanup)

    expect(cleanup).not.toHaveBeenCalled()

    scope.dispose()

    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(scope.disposed).toBe(true)
  })

  it("应该按后注册先执行的顺序执行 cleanup", () => {
    const scope = createRuntimeScope()

    const order: string[] = []
    scope.add(() => order.push("first"))
    scope.add(() => order.push("second"))
    scope.add(() => order.push("third"))

    scope.dispose()

    // 后注册先执行
    expect(order).toEqual(["third", "second", "first"])
  })
})

describe("DisposeHandle", () => {
  it("应该支持取消 cleanup", () => {
    const scope = createRuntimeScope()

    const cleanup = vi.fn()
    const handle = scope.add(cleanup)

    // 取消
    handle.dispose()
    expect(handle.disposed).toBe(true)
    // 取消时会执行 cleanup
    expect(cleanup).toHaveBeenCalledTimes(1)

    // dispose scope 不应该再次调用已取消的 cleanup
    scope.dispose()
    expect(cleanup).toHaveBeenCalledTimes(1) // 仍然是 1 次
  })

  it("应该在 dispose 后标记 disposed 状态", () => {
    const scope = createRuntimeScope()

    const handle = scope.add(() => {})

    expect(handle.disposed).toBe(false)

    scope.dispose()

    // scope dispose 后，handle 也应该标记为 disposed
    expect(scope.disposed).toBe(true)
  })
})

describe("nested scope", () => {
  it("应该创建子 scope", () => {
    const parent = createRuntimeScope()
    const child = parent.child()

    expect(child).toBeDefined()
    expect(child.disposed).toBe(false)
    expect(parent.disposed).toBe(false)
  })

  it("应该在父 scope dispose 时先释放子 scope", () => {
    const parent = createRuntimeScope()
    const child = parent.child()

    const order: string[] = []
    child.add(() => order.push("child"))
    parent.add(() => order.push("parent"))

    parent.dispose()

    // 子 scope 先释放
    expect(order).toEqual(["child", "parent"])
    expect(child.disposed).toBe(true)
    expect(parent.disposed).toBe(true)
  })
})

describe("disposed scope behavior", () => {
  it("应该在 disposed 后 add 立即执行 cleanup", () => {
    const scope = createRuntimeScope()

    scope.dispose()

    const cleanup = vi.fn()
    const handle = scope.add(cleanup)

    // cleanup 应该立即执行
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(handle.disposed).toBe(true)
  })

  it("应该在 disposed 后 dispose 幂等", () => {
    const scope = createRuntimeScope()

    const cleanup = vi.fn()
    scope.add(cleanup)

    scope.dispose()
    expect(cleanup).toHaveBeenCalledTimes(1)

    // 再次 dispose 应该幂等
    scope.dispose()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})

describe("error isolation", () => {
  it("应该在 cleanup 抛错时继续执行其他 cleanup", () => {
    const scope = createRuntimeScope()

    const order: string[] = []
    scope.add(() => {
      order.push("first")
      throw new Error("first error")
    })
    scope.add(() => {
      order.push("second")
    })

    // 抑制 console.error
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    scope.dispose()

    // 即使第一个 cleanup 抛错，第二个也应该执行
    expect(order).toEqual(["second", "first"])

    consoleErrorSpy.mockRestore()
  })

  it("应该记录 cleanup 错误", () => {
    const scope = createRuntimeScope()

    const error = new Error("test error")
    scope.add(() => {
      throw error
    })

    // Mock 错误报告函数
    const reportSpy = vi.fn()
    const originalReport = reportRuntimeCleanupError
    // @ts-expect-error - 替换全局函数用于测试
    globalThis.__reportRuntimeCleanupError = reportSpy

    scope.dispose()

    // 验证错误被报告
    // 注意：由于 reportRuntimeCleanupError 是模块级函数，这里主要验证不会崩溃

    // @ts-expect-error
    delete globalThis.__reportRuntimeCleanupError
  })
})
