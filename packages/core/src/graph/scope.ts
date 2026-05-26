/**
 * Scope - 资源生命周期边界。
 *
 * Scope 管理 cleanup 的注册、嵌套 scope、dispose 执行。
 * 规则：
 * - dispose 幂等
 * - 子 scope 先释放，父 scope 后释放
 * - cleanup 抛错不阻断后续 cleanup
 * - disposed 后 add() 立即执行 cleanup 并返回已释放 handle
 *
 * @module core/graph/scope
 */

/**
 * Scope 执行的清理函数。
 */
export type DisposeFn = () => void

/**
 * cleanup 注册后的释放句柄。
 *
 * @remarks
 * 调用 `dispose()` 会立即执行对应 cleanup，并阻止它在 scope dispose 时再次执行。
 */
export interface DisposeHandle {
  /** cleanup 是否已经执行或取消。 */
  readonly disposed: boolean

  /** 执行并移除当前 cleanup。 */
  dispose(): void
}

/**
 * 资源生命周期作用域。
 *
 * @remarks
 * Scope 支持嵌套生命周期：父 scope dispose 时会先 dispose 子 scope，再按注册逆序
 * 执行自身 cleanup。cleanup 抛错会被捕获并上报，不会阻断后续清理。
 */
export interface Scope {
  /** 当前 scope 是否已经释放。 */
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
  child(): Scope

  /**
   * 释放当前 scope 及所有子 scope。
   *
   * 幂等操作，重复调用不执行任何操作。
   */
  dispose(): void
}

/**
 * 创建一个资源生命周期作用域。
 *
 * @returns 新创建的 `Scope`。
 *
 * @remarks
 * 已释放的 scope 再调用 `add()` 时会立即执行 cleanup，这让调用方无需为异步
 * mount 流程额外判断资源是否已经过期。
 */
export function createScope(): Scope {
  let disposed = false
  const cleanups = new Set<DisposeFn>()
  const children = new Set<Scope>()

  const addCleanup = (dispose: DisposeFn): DisposeHandle => {
    if (disposed) {
      runCleanup(dispose)

      return createDisposedHandle()
    }

    let handleDisposed = false
    cleanups.add(dispose)

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

  const createChildScope = (): Scope => {
    const childScope = createScope()
    children.add(childScope)

    addCleanup(() => {
      children.delete(childScope)
      childScope.dispose()
    })

    return childScope
  }

  const disposeScope = (): void => {
    if (disposed) {
      return
    }

    disposed = true

    for (const childScope of Array.from(children).reverse()) {
      childScope.dispose()
    }

    children.clear()

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
 * `createScope` 的兼容别名。
 */
export const createRuntimeScope = createScope

const createDisposedHandle = (): DisposeHandle => {
  return {
    disposed: true,
    dispose: noop,
  }
}

const noop = (): void => {}

const runCleanup = (cleanup: DisposeFn): void => {
  try {
    cleanup()
  } catch (error) {
    reportRuntimeCleanupError(error)
  }
}

/**
 * 报告 cleanup 错误。
 *
 * @remarks
 * Scope 会吞掉 cleanup 抛出的错误以保证后续清理继续执行；这个函数是统一的
 * 错误上报出口。
 *
 * @param error - cleanup 抛出的错误。
 */
export function reportRuntimeCleanupError(error: unknown): void {
  console.error("[Scope] Cleanup error:", error)
}
