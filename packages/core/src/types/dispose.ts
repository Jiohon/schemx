/**
 * DisposeBag 资源释放契约。
 *
 * DisposeBag 用于按节点收集 effect、resolver、runner、cleanup hook 等释放函数，
 * 并按 pre -> main -> post phase 释放。
 *
 * @module core/types/dispose
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
 * - `main`：清理字段状态、validation 等"业务"资源
 * - `post`：最后清理渲染侧、外部回调等"下游"资源
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
 * 内部节点通过此接口注册和释放响应式资源。
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
   */
  add: (callback: DisposeCallback, phase?: DisposePhase) => void

  /**
   * 注册一个在 flush 时执行的外部回调，并返回可取消的订阅句柄。
   *
   * 与 `add` 的区别：
   * - `add` 面向内部资源注册，无需取消能力
   * - `onDispose` 面向外部消费方，需要提前取消注册的能力
   *
   * `onDispose` 注册的回调始终在 `post` phase 执行，
   * 确保在内部资源清理完成后再通知外部。
   */
  onDispose: (callback: DisposeCallback) => DisposeSubscription

  /**
   * 执行所有已注册的清理函数并标记 bag 为已 flush。
   *
   * 执行顺序：pre → main → post，同 phase 内按注册逆序（LIFO）执行。
   *
   * 保证：
   * - 幂等：重复调用只执行一次
   * - 异常隔离：单个 callback 抛出异常不影响后续 callback 执行
   * - flush 后对 bag 的 add / onDispose 调用立即执行对应 cleanup
   */
  flush: () => void
}
