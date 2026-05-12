/**
 * Runtime 节点核心结构定义。
 *
 * 将不可变的 Raw Schema 编译为可变的运行时树节点。
 *
 * 设计原则：
 *
 * - RuntimeNode 负责"树结构、节点身份、生命周期"
 * - FieldRuntime 负责"字段状态"（→ ./field）
 * - DependencyRuntime 负责"动态 subtree 执行状态"（→ ./dependency）
 * - DisposeBag 负责"资源释放契约"（→ ./dispose）
 * - RuntimeNode 不直接面向 UI 暴露，框架层应该通过 Runtime facade / Renderer Adapter 消费
 *
 * @module core/types/runtime
 */

import type { ReactiveSignal } from "../reactivity"
import type { DependencyRuntimeNode } from "./dependency"
import type { DisposeBag, DisposeCallback, DisposeSubscription } from "./dispose"
import type { FieldRuntimeNode } from "./field"
import type { Values } from "./form"
import type { SchemxField, SchemxGroupField } from "./schema"

// ---------------------------------------------------------------------------
// Re-exports（子域类型统一从 runtime.ts 可获取）
// ---------------------------------------------------------------------------

// export type {
//   DisposeBag,
//   DisposeCallback,
//   DisposePhase,
//   DisposeSubscription,
// } from "./dispose"

// export type {
//   FieldRuntime,
//   FieldRuntimeNode,
//   RuntimeFieldDefaultProps,
//   RuntimeFieldDefaults,
//   RuntimeFieldResolvedProps,
// } from "./field"
// export { isFieldRuntimeNode } from "./field"

// export type {
//   DependencyRuntime,
//   DependencyRuntimeNode,
//   SubtreeReplacement,
// } from "./dependency"
// export { isDependencyRuntimeNode } from "./dependency"

// ---------------------------------------------------------------------------
// 基础枚举与工具类型
// ---------------------------------------------------------------------------

/**
 * Runtime 节点类型。
 */
export type RuntimeNodeType = "field" | "group" | "dependency"

/**
 * per-computation 竞态防护容器。
 *
 * 每个异步属性计算（disabled、visible、required、componentProps 等）
 * 应各自持有独立的 version，避免多个并发 async 计算互相推进同一个 version
 * 导致过期结果误判为最新结果。
 *
 * 使用约定：
 * - 每次发起新一轮计算时，先执行 `++computation.version` 捕获当前版本号
 * - 计算完成时比对版本号，不一致则丢弃结果
 * - `abortController` 在新一轮计算开始时 abort 上一轮（适用于 fetch 类副作用）
 *
 * @typeParam T - 计算结果类型
 */
export interface ReactiveComputation<T> {
  /**
   * 当前版本号。
   *
   * 每次发起新计算时自增，用于丢弃过期异步结果。
   */
  version: number

  /**
   * 计算结果信号。
   */
  value: ReactiveSignal<T>

  /**
   * 当前飞行中请求的 AbortController。
   *
   * 发起新一轮计算前，应先 abort 上一轮。
   * 仅在计算涉及 fetch 等可取消副作用时有效。
   * 对于纯同步计算，此字段可忽略。
   */
  abortController: AbortController | null

  /**
   * 释放当前计算持有的所有响应式资源（effect、computed 订阅等）。
   */
  dispose: () => void
}

// ---------------------------------------------------------------------------
// RuntimeNodeBase
// ---------------------------------------------------------------------------

/**
 * Runtime 节点公共字段。
 *
 * RuntimeNodeBase 只保存节点级别的信息：
 *
 * - 节点身份
 * - 父子关系
 * - 生命周期状态
 * - DisposeBag
 *
 * 不应该在这里放字段属性、校验状态、dependency 执行状态等业务状态。
 *
 * ## Dispose 语义
 *
 * `dispose()` 是**级联操作**，调用时会：
 *
 * 1. 递归 dispose 所有子节点（先子后父）
 * 2. 执行当前节点 `disposeBag` 中注册的所有清理函数
 * 3. 将 `disposed` signal 置为 true，通知所有订阅方（如 Renderer Adapter）
 *
 * 若只需释放当前节点自身资源而不递归子树，请调用 `disposeSelf()`。
 *
 * @typeParam T - 表单值类型
 */
export interface RuntimeNodeBase<T extends Values = Values> {
  /**
   * 节点类型。
   */
  type: RuntimeNodeType

  /**
   * 运行时自增 id。
   *
   * 主要用于：
   * - 调试
   * - devtools
   * - 框架层 key fallback
   */
  id: number

  /**
   * 稳定身份 key。
   *
   * 推荐由 ownerPath + schema identity 生成。
   *
   * 用于：
   * - runtime node reuse
   * - subtree diff
   * - renderer adapter key
   */
  key: string

  /**
   * 父节点。
   *
   * root 节点为 null。
   */
  parent: RuntimeNode<T> | null

  /**
   * 节点是否处于挂载状态。
   */
  mounted: boolean

  /**
   * 节点是否等待 scheduler 刷新。
   */
  dirty: boolean

  /**
   * 节点是否已销毁。
   *
   * 使用响应式 signal，供 Renderer Adapter 订阅 dispose 事件，
   * 在节点销毁时自动卸载对应的 UI 组件，无需轮询或手动检查。
   *
   * @example
   * ```ts
   * // Renderer Adapter 内
   * effect(() => {
   *   if (node.disposed.value) {
   *     unmountComponent(node.id)
   *   }
   * })
   * ```
   */
  disposed: ReactiveSignal<boolean>

  /**
   * 当前节点持有的 effect、runner、resolver、watcher 等释放函数集合。
   *
   * 所有 node-scoped reactive resource 都必须注册到 disposeBag。
   */
  disposeBag: DisposeBag

  /**
   * 注册一个在节点 dispose 时执行的回调。
   *
   * 供 Renderer Adapter 等外部消费方注册清理逻辑，
   * 无需订阅 `disposed` signal，也无需在外部维护 effect。
   *
   * @returns DisposeSubscription 句柄，可提前取消注册
   *
   * @example
   * ```ts
   * const sub = node.onDispose(() => unmountComponent(node.id))
   * // 如需提前取消：
   * sub.unsubscribe()
   * ```
   */
  onDispose: (callback: DisposeCallback) => DisposeSubscription

  /**
   * 只释放当前节点自身持有的资源，**不递归子树**。
   *
   * 适用场景：
   * - 手动管理子节点生命周期时
   * - runtime graph replace subtree 时，先 dispose 自身 watcher，再处理子节点
   *
   * 正常情况下优先使用 `dispose()`。
   */
  disposeSelf: () => void

  /**
   * 级联释放当前节点及其完整子树持有的所有订阅和运行时资源。
   *
   * 执行顺序（先子后父）：
   *
   * 1. 递归调用所有子节点的 `dispose()`
   * 2. 执行 `disposeBag` 中注册的所有清理函数
   * 3. 将 `disposed` 置为 true
   *
   * dispose 后节点不可再使用。任何对已 disposed 节点的操作
   * 应在调用方通过检查 `disposed.value` 进行防护。
   */
  dispose: () => void
}

// ---------------------------------------------------------------------------
// GroupRuntimeNode
// ---------------------------------------------------------------------------

/**
 * 分组节点。
 *
 * 对应 `componentType: "group"`。
 *
 * GroupRuntimeNode 只负责承载静态 children 的运行时子树。
 * children 在 compile 阶段确定，不会在运行时动态增减。
 * 若需要动态 children，应使用 DependencyRuntimeNode。
 */
export interface GroupRuntimeNode<T extends Values = Values> extends RuntimeNodeBase<T> {
  type: "group"

  /**
   * 分组原始 schema。
   */
  schema: SchemxGroupField<T>

  /**
   * 分组运行时子节点。
   *
   * 静态子树，compile 后不变。
   */
  children: RuntimeNode<T>[]
}

// ---------------------------------------------------------------------------
// 联合类型
// ---------------------------------------------------------------------------

/**
 * Runtime 节点联合类型。
 */
export type RuntimeNode<T extends Values = Values> =
  | FieldRuntimeNode<T>
  | GroupRuntimeNode<T>
  | DependencyRuntimeNode<T>

/**
 * 编译器可接收的 schema 类型。
 */
export type RuntimeSchema<T extends Values = Values> = SchemxField<T>

// ---------------------------------------------------------------------------
// 类型守卫
// ---------------------------------------------------------------------------

/**
 * 判断节点是否为分组节点。
 */
export function isGroupRuntimeNode<T extends Values = Values>(
  node: RuntimeNode<T>
): node is GroupRuntimeNode<T> {
  return node.type === "group"
}

/**
 * 判断节点是否含有静态 children（group 或 dependency）。
 */
export function hasChildren<T extends Values = Values>(
  node: RuntimeNode<T>
): node is GroupRuntimeNode<T> | DependencyRuntimeNode<T> {
  return node.type === "group" || node.type === "dependency"
}
