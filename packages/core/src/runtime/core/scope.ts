/**
 * RuntimeScope - 资源生命周期边界。
 *
 * Scope 管理 cleanup 的注册、嵌套 scope、dispose 执行。
 * 规则：
 * - dispose 幂等
 * - 子 scope 先释放，父 scope 后释放
 * - cleanup 抛错不阻断后续 cleanup
 * - disposed 后 add() 立即执行 cleanup 并返回已释放 handle
 *
 * @module core/runtime/core/scope
 */

/**
 * 释放函数类型。
 */
export type DisposeFn = () => void

/**
 * 释放句柄，支持取消。
 */
export interface DisposeHandle {
  /**
   * 是否已释放。
   */
  readonly disposed: boolean

  /**
   * 取消释放。
   */
  dispose(): void
}

/**
 * 资源生命周期作用域。
 */
export interface RuntimeScope {
  /**
   * 是否已释放。
   */
  readonly disposed: boolean

  /**
   * 注册释放函数。
   *
   * 如果 scope 已 disposed，立即执行 cleanup 并返回已释放 handle。
   *
   * @param dispose - 释放函数
   * @returns 可取消的释放句柄
   */
  add(dispose: DisposeFn): DisposeHandle

  /**
   * 创建子 scope。
   *
   * 子 scope 的 dispose 会在父 scope dispose 前执行。
   *
   * @returns 子 scope 实例
   */
  child(): RuntimeScope

  /**
   * 释放当前 scope 及所有子 scope。
   *
   * 幂等操作，重复调用不执行任何操作。
   */
  dispose(): void
}

/**
 * 创建一个 RuntimeScope 实例。
 *
 * @returns 新创建的 RuntimeScope
 *
 * @example
 * ```ts
 * const scope = createRuntimeScope()
 *
 * // 注册 cleanup
 * const handle = scope.add(() => {
 *   console.log("cleanup")
 * })
 *
 * // 取消 cleanup
 * handle.dispose()
 *
 * // 创建子 scope
 * const childScope = scope.child()
 *
 * // 释放 scope
 * scope.dispose()
 * ```
 */
export function createRuntimeScope(): RuntimeScope {
  let disposed = false
  const cleanups = new Set<DisposeFn>()
  const children = new Set<RuntimeScope>()

  /**
   * 注册 cleanup。
   */
  const addCleanup = (dispose: DisposeFn): DisposeHandle => {
    // 已 disposed 时立即执行 cleanup
    if (disposed) {
      runCleanup(dispose)
      return createDisposedHandle()
    }

    let handleDisposed = false
    cleanups.add(dispose)

    /**
     * 取消 cleanup。
     */
    const disposeHandle = (): void => {
      if (handleDisposed) {
        return
      }

      handleDisposed = true
      cleanups.delete(dispose)
      runCleanup(dispose)
    }

    return {
      get disposed() {
        return handleDisposed
      },
      dispose: disposeHandle,
    }
  }

  /**
   * 创建子 scope。
   */
  const createChildScope = (): RuntimeScope => {
    const childScope = createRuntimeScope()
    children.add(childScope)

    // 注册子 scope 的释放
    addCleanup(() => {
      children.delete(childScope)
      childScope.dispose()
    })

    return childScope
  }

  /**
   * 释放 scope。
   */
  const disposeScope = (): void => {
    // 幂等检查
    if (disposed) {
      return
    }

    disposed = true

    // 先释放子 scope（逆序）
    for (const childScope of Array.from(children).reverse()) {
      childScope.dispose()
    }
    children.clear()

    // 再执行 cleanup（逆序）
    for (const cleanup of Array.from(cleanups).reverse()) {
      runCleanup(cleanup)
    }
    cleanups.clear()
  }

  return {
    get disposed() {
      return disposed
    },
    add: addCleanup,
    child: createChildScope,
    dispose: disposeScope,
  }
}

/**
 * 创建已 disposed 的 DisposeHandle。
 */
const createDisposedHandle = (): DisposeHandle => {
  return {
    disposed: true,
    dispose: noop,
  }
}

/**
 * 空函数。
 */
const noop = (): void => {}

/**
 * 执行 cleanup，捕获并记录错误。
 *
 * @param cleanup - 清理函数
 */
const runCleanup = (cleanup: DisposeFn): void => {
  try {
    cleanup()
  } catch (error) {
    // 记录错误但不阻断
    reportRuntimeCleanupError(error)
  }
}

/**
 * 报告 cleanup 错误。
 *
 * 可被子模块覆盖以自定义错误处理。
 *
 * @param error - 错误对象
 */
export function reportRuntimeCleanupError(error: unknown): void {
  console.error("[RuntimeScope] Cleanup error:", error)
}
