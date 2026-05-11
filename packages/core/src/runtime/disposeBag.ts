/**
 * Runtime 节点级资源释放容器。
 *
 * DisposeBag 用于按节点收集 effect、resolver、runner、cleanup hook 等释放函数，
 * 并按 pre -> main -> post phase 释放。
 *
 * @module core/runtime/disposeBag
 */

/**
 * 注册到 DisposeBag 的清理函数类型。
 */
export type DisposeCallback = () => void

/**
 * DisposeBag 中清理任务的执行阶段。
 *
 * 与 Scheduler 的 pre / main / post phase 对齐：
 *
 * - `pre`：优先清理 watcher、dependency 监听等"上游"资源
 *   例：dependency engine 的 effect、dynamic prop 的 computed 订阅
 * - `main`：清理字段状态、validation 等"业务"资源
 *   例：FieldRuntime 内各 ReactiveComputation 的 effect
 * - `post`：最后清理渲染侧、外部回调等"下游"资源
 *   例：Renderer Adapter 注册的 onDispose 回调、scheduler cleanup hook
 *
 * 同一 phase 内按注册逆序执行（LIFO），便于后注册且依赖前置资源的
 * cleanup 先释放。
 */
export type DisposePhase = "pre" | "main" | "post"

/**
 * onDispose 注册返回的订阅句柄。
 *
 * 持有此句柄可在节点 dispose 前提前取消注册。
 */
export interface DisposeSubscription {
  /**
   * 取消此次 onDispose 注册。
   *
   * 调用后对应回调不会在 flush 时执行。
   * 若节点已经 disposed，调用此方法是安全的（no-op）。
   */
  unsubscribe: () => void
}

/**
 * DisposeBag 接口。
 *
 * RuntimeNode 通过此接口注册和释放响应式资源。
 */
export interface DisposeBag {
  /**
   * 当前 bag 是否已 flush。
   *
   * flush 后为 true，任何 add/onDispose 调用都会立即 best-effort 执行，
   * 避免 late cleanup 静默泄漏。
   */
  readonly flushed: boolean

  /**
   * 注册一个清理函数。
   *
   * @param callback - 清理函数
   * @param phase - 执行阶段，默认 `"main"`
   *
   * @example
   * ```ts
   * // 注册 effect 清理（main phase，默认）
   * bag.add(effect(() => { ... }))
   *
   * // 注册 dependency watcher（pre phase，优先于 field 状态清理）
   * bag.add(watchDependency(...), "pre")
   *
   * // 注册 renderer 清理（post phase，最后执行）
   * bag.add(unmountComponent, "post")
   * ```
   */
  add: (callback: DisposeCallback, phase?: DisposePhase) => void

  /**
   * 注册一个在 flush 时执行的外部回调，并返回可取消的订阅句柄。
   *
   * 与 `add` 的区别：
   * - `add` 面向内部资源注册，无需取消能力
   * - `onDispose` 面向外部消费方（如 Renderer Adapter），需要提前取消注册的能力
   *
   * `onDispose` 注册的回调始终在 `post` phase 执行，
   * 确保在内部资源（effect、watcher）清理完成后再通知外部。
   *
   * @example
   * ```ts
   * // Renderer Adapter 内
   * const sub = node.disposeBag.onDispose(() => {
   *   unmountComponent(node.id)
   * })
   *
   * // 若组件因其他原因提前卸载，取消注册避免重复执行
   * sub.unsubscribe()
   * ```
   */
  onDispose: (callback: DisposeCallback) => DisposeSubscription

  /**
   * 执行所有已注册的清理函数并标记 bag 为已 flush。
   *
   * 执行顺序：pre → main → post，同 phase 内按注册逆序（LIFO）执行。
   *
   * 保证：
   * - 幂等：重复调用只执行一次
   * - 异常隔离：单个 callback 抛出异常不影响后续 callback 执行，
   *   所有异常收集后在 flush 结束时统一抛出（AggregateError）
   * - flush 后对 bag 的 add / onDispose 调用立即执行对应 cleanup
   */
  flush: () => void
}

interface DisposeEntry {
  callback: DisposeCallback
  phase: DisposePhase
  id?: number
}

const PHASE_ORDER: DisposePhase[] = ["pre", "main", "post"]

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
  const entries: DisposeEntry[] = []
  let flushed = false

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
      console.error("[schemx] runtime cleanup 执行错误:", error)
    }
  }

  function add(callback: DisposeCallback, phase: DisposePhase = "main"): void {
    if (flushed) {
      run(callback)

      return
    }

    entries.push({ callback, phase })
  }

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
 */
export function combineBags(...bags: DisposeBag[]): { flush: () => void } {
  return {
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
 * 该工具用于测试和低层结构释放辅助。完整 RuntimeNode dispose 仍应优先调用
 * node.dispose()，因为节点自身还需要维护 parent/mounted/disposed 等状态。
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

function noop(): void {}
