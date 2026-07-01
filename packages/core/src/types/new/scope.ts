/**
 * Scope - 运行时资源生命周期作用域。
 *
 * Scope 只表达资源清理、子作用域和幂等释放，不感知 schema、field、
 * dependency、validation 或 renderer。更细的领域资源应通过子 scope
 * 表达自己的生命周期边界。
 *
 * @module core/runtime-scope
 */

/**
 * 资源清理函数。
 */
export type ScopeCleanup = () => void

/**
 * Scope 运行状态。
 *
 * 当前实现只暴露 `disposed`，该状态用于目标实现的调试信息和状态投影，
 * 不要求所有 scope 实例立即持有完整状态机。
 */
export type ScopeStatus = "active" | "disposing" | "disposed"

/**
 * Scope 调试信息。
 */
export interface ScopeDebugInfo {
  /** scope 名称，例如 `root`、`field`、`dependency:renderer`。 */
  readonly name?: string
  /** 关联的 runtime node id；仅用于排查资源归属。 */
  readonly nodeId?: number
  /** 额外调试标签。 */
  readonly tags?: readonly string[]
}

/**
 * 创建子 Scope 的选项。
 */
export interface CreateScopeOptions {
  /** 调试信息。 */
  readonly debug?: ScopeDebugInfo
}

/**
 * cleanup 注册后的释放句柄。
 */
export interface ScopeCleanupHandle {
  /** cleanup 是否已经执行或取消。 */
  readonly disposed: boolean
  /** 立即执行并移除当前 cleanup。 */
  dispose(): void
}

/**
 * 生命周期作用域。
 *
 * 该接口刻意贴近现有 `node/scope.ts` 的 `add`、`child`、`dispose`
 * 语义，避免目标类型和当前实现形成两套生命周期 API。
 */
export interface Scope {
  /** 父 Scope；root scope 没有 parent。 */
  readonly parent?: Scope | null
  /** 当前状态；实现可以只通过 `disposed` 暴露最小状态。 */
  readonly status?: ScopeStatus
  /** scope 是否已经释放。 */
  readonly disposed: boolean
  /** 调试信息。 */
  readonly debug?: ScopeDebugInfo

  /**
   * 在当前 scope 注册 cleanup。
   *
   * 如果 scope 已经 disposed，cleanup 应立即执行并返回已释放 handle，
   * 以避免异步 mount 流程泄漏资源。
   */
  add(cleanup: ScopeCleanup): ScopeCleanupHandle

  /**
   * 创建当前 scope 的子 scope。
   *
   * 父 scope dispose 时应先 dispose 子 scope，再执行自身 cleanup。
   */
  child(options?: CreateScopeOptions): Scope

  /**
   * 释放当前 scope 及其子 scope。
   *
   * dispose 必须幂等，cleanup 抛错不应阻断后续 cleanup。
   */
  dispose(): void
}
