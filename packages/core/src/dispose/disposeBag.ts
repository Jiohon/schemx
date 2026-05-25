/**
 * 节点级资源释放容器。
 *
 * DisposeBag 用于按节点收集 effect、resolver、runner、cleanup hook 等释放函数，
 * 并按 pre -> main -> post phase 释放。
 *
 * @module core/dispose/disposeBag
 */

import type {
  DisposeBag,
  DisposeCallback,
  DisposePhase,
  DisposeSubscription,
} from "../types"

/**
 * 释放条目内部结构。
 */
interface DisposeEntry {
  /**
   * 释放回调函数。
   */
  callback: DisposeCallback
  /**
   * 释放阶段。
   */
  phase: DisposePhase
  /**
   * 条目标识，用于取消订阅。
   */
  id?: number
}

/**
 * 释放阶段执行顺序。
 */
const PHASE_ORDER: DisposePhase[] = ["pre", "main", "post"]

/**
 * 下一个条目标识。
 */
let nextId = 0

/**
 * 创建一个新的 DisposeBag 实例。
 *
 * @example
 * ```ts
 * const bag = createDisposeBag()
 *
 * // 注册 effect
 * bag.add(effect(() => {
 *   console.log(signal.value)
 * }))
 *
 * // 注册 dependency watcher（优先清理）
 * bag.add(watchDeps(node, handler), "pre")
 *
 * // 外部注册 onDispose（可取消）
 * const sub = bag.onDispose(() => unmountComponent())
 *
 * // 节点销毁时：
 * bag.flush()
 * // → pre callbacks 执行
 * // → main callbacks 执行
 * // → post callbacks 执行（包含 onDispose 注册的回调）
 * // → flushed = true
 * ```
 */
export function createDisposeBag(): DisposeBag {
  /**
   * 释放条目列表。
   */
  const entries: DisposeEntry[] = []
  /**
   * 是否已释放。
   */
  let flushed = false

  /**
   * 执行单个释放回调。
   *
   * @param callback - 释放回调函数
   * @param errors - 错误收集数组，用于批量抛出
   */
  function run(callback: DisposeCallback, errors?: unknown[]): void {
    try {
      callback()
    } catch (error) {
      if (errors) {
        errors.push(error)

        return
      }

      // Late cleanup is best-effort. The node has already completed flush, so
      // throwing here would make async cleanup registration crash callers.
      console.error("[schemx] cleanup 执行错误:", error)
    }
  }

  /**
   * 添加释放回调。
   *
   * 如果已释放，则立即执行回调。
   *
   * @param callback - 释放回调函数
   * @param phase - 释放阶段，默认为 main
   */
  function add(callback: DisposeCallback, phase: DisposePhase = "main"): void {
    if (flushed) {
      run(callback)

      return
    }

    entries.push({ callback, phase })
  }

  /**
   * 注册可取消的释放回调。
   *
   * 回调会在 post 阶段执行，可通过返回的订阅对象取消。
   *
   * @param callback - 释放回调函数
   * @returns 可取消的订阅对象
   */
  function onDispose(callback: DisposeCallback): DisposeSubscription {
    if (flushed) {
      run(callback)

      return { unsubscribe: noop }
    }

    const id = nextId++
    entries.push({ callback, phase: "post", id })

    return {
      unsubscribe(): void {
        const index = entries.findIndex((entry) => entry.id === id)
        if (index !== -1) entries.splice(index, 1)
      },
    }
  }

  /**
   * 执行所有释放回调。
   *
   * 按 pre -> main -> post 顺序执行，同阶段内使用 LIFO 顺序。
   * 所有错误会在全部执行完成后统一抛出。
   */
  function flush(): void {
    if (flushed) return

    flushed = true
    const errors: unknown[] = []

    for (const phase of PHASE_ORDER) {
      const phaseEntries = entries.filter((entry) => entry.phase === phase)

      // Same-phase cleanup uses LIFO so resources depending on earlier
      // registrations are released first.
      for (let index = phaseEntries.length - 1; index >= 0; index -= 1) {
        run(phaseEntries[index].callback, errors)
      }
    }

    entries.length = 0

    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) {
      throw new AggregateError(
        errors,
        `DisposeBag flush encountered ${errors.length} error(s)`
      )
    }
  }

  return {
    get flushed() {
      return flushed
    },
    add,
    onDispose,
    flush,
  }
}

/**
 * 将多个 DisposeBag 组合成一个 flush 入口。
 *
 * 所有 bag 都会被尝试 flush；任意一个 bag 抛错不会阻断后续 bag。
 * 错误会在全部 flush 完成后统一抛出。
 *
 * @param bags - 要组合的 DisposeBag 列表
 * @returns 包含 flush 方法的对象
 *
 * @example
 * ```ts
 * const bag1 = createDisposeBag()
 * const bag2 = createDisposeBag()
 * const combined = combineBags(bag1, bag2)
 *
 * // 一次性释放所有 bag
 * combined.flush()
 * ```
 */
export function combineBags(...bags: DisposeBag[]): { flush: () => void } {
  return {
    /**
     * 释放所有组合的 DisposeBag。
     *
     * 按顺序尝试释放每个 bag，收集所有错误后统一抛出。
     */
    flush(): void {
      const errors: unknown[] = []

      for (const bag of bags) {
        try {
          bag.flush()
        } catch (error) {
          if (error instanceof AggregateError) {
            errors.push(...error.errors)
          } else {
            errors.push(error)
          }
        }
      }

      if (errors.length === 1) throw errors[0]
      if (errors.length > 1) {
        throw new AggregateError(
          errors,
          `combineBags flush encountered ${errors.length} error(s)`
        )
      }
    },
  }
}

/**
 * 递归释放一个只包含 disposeBag/children 的树形结构。
 *
 * 该工具用于测试和低层结构释放辅助。完整 Fiber dispose 仍应优先调用。
 * node.dispose()，因为节点自身还需要维护 parent/mounted/disposed 等状态。
 *
 * @param node - 树形节点，包含 disposeBag 和可选的 children
 *
 * @example
 * ```ts
 * const tree = {
 *   disposeBag: createDisposeBag(),
 *   children: [
 *     { disposeBag: createDisposeBag() },
 *     { disposeBag: createDisposeBag() },
 *   ],
 * }
 *
 * // 递归释放整棵树
 * disposeSubtree(tree)
 * ```
 */
export function disposeSubtree(node: {
  disposeBag: DisposeBag
  children?: Array<{ disposeBag: DisposeBag; children?: unknown[] }>
}): void {
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      disposeSubtree(child as Parameters<typeof disposeSubtree>[0])
    }
  }

  node.disposeBag.flush()
}

/**
 * 空操作函数。
 */
function noop(): void {}
