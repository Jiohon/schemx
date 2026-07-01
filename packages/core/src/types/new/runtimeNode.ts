/**
 * RuntimeNode - 表单运行时结构节点。
 *
 * RuntimeNode 只表达：
 * - 稳定身份
 * - 节点类型
 * - 父子结构
 * - 节点生命周期 scope
 * - mounted / disposed 状态
 *
 * descriptor、runtimeState、viewState、dependencySlot 等领域资源
 * 不直接挂在 RuntimeNode 上，而是由 RuntimeNodeResources 承载。
 */

import type { Scope } from "./scope"
import type { Signal } from "../../reactivity"
import type { Values } from ".."

/**
 * Runtime node 支持的节点类型。
 */
export type RuntimeNodeType = "root" | "field" | "group" | "dependency"

/**
 * RuntimeNode 内部稳定 id。
 */
export type RuntimeNodeId = number

/**
 * 容器 children 响应式状态。
 */
export interface RuntimeChildrenState<TValues extends Values = Values> {
  readonly children: Signal<readonly DescribedRuntimeNode<TValues>[]>
}

/**
 * 所有 RuntimeNode 共享的结构字段。
 */
interface BaseRuntimeNode<TValues extends Values = Values> {
  /**
   * RuntimeNode 内部稳定 id。
   */
  readonly id: RuntimeNodeId

  /**
   * 用于 keyed reconcile 的稳定 key。
   */
  readonly key: string

  /**
   * 节点类型。
   */
  readonly type: RuntimeNodeType

  /**
   * 父 RuntimeNode。
   *
   * root 节点没有 parent。
   */
  parent: RuntimeNode<TValues> | null

  /**
   * RuntimeNode 自身的完整生命周期边界。
   *
   * 当 node 被 reconcile 移除时，应 dispose 当前 scope。
   */
  scope: Scope

  /**
   * 领域资源是否已经完成挂载。
   */
  mounted: Signal<boolean>

  /**
   * 节点是否已经进入销毁流程。
   */
  disposed: Signal<boolean>
}

/**
 * RootRuntimeNode - 透明根节点。
 *
 * Root 不对应任何 schema，只负责承载顶层 children。
 */
export interface RootRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  readonly type: "root"

  parent: null

  /**
   * 顶层 runtime 子节点。
   */
  childNodes: DescribedRuntimeNode<TValues>[]
}

/**
 * FieldRuntimeNode - 字段节点。
 *
 * Field 不承载结构子节点。
 * 字段 descriptor、runtimeState、viewState、校验资源等都由 RuntimeNodeResources 承载。
 */
export interface FieldRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  readonly type: "field"

  parent: ContainerRuntimeNode<TValues>
}

/**
 * GroupRuntimeNode - 分组节点。
 *
 * Group 负责结构嵌套。
 */
export interface GroupRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  readonly type: "group"

  parent: ContainerRuntimeNode<TValues>

  /**
   * 静态 schema children 编译后的 runtime 子节点。
   */
  childNodes: DescribedRuntimeNode<TValues>[]
}

/**
 * DependencyRuntimeNode - 动态 dependency 节点。
 *
 * Dependency 的 children 来自 renderer 动态产物。
 */
export interface DependencyRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  readonly type: "dependency"

  parent: ContainerRuntimeNode<TValues>

  /**
   * dependency renderer 产出的动态 runtime 子节点。
   */
  childNodes: DescribedRuntimeNode<TValues>[]
}

/**
 * 所有 RuntimeNode。
 */
export type RuntimeNode<TValues extends Values = Values> =
  | RootRuntimeNode<TValues>
  | FieldRuntimeNode<TValues>
  | GroupRuntimeNode<TValues>
  | DependencyRuntimeNode<TValues>

/**
 * 除 root 外，所有带 descriptor 的 RuntimeNode。
 */
export type DescribedRuntimeNode<TValues extends Values = Values> =
  | FieldRuntimeNode<TValues>
  | GroupRuntimeNode<TValues>
  | DependencyRuntimeNode<TValues>

/**
 * 可以承载子节点的 RuntimeNode。
 */
export type ContainerRuntimeNode<TValues extends Values = Values> =
  | RootRuntimeNode<TValues>
  | GroupRuntimeNode<TValues>
  | DependencyRuntimeNode<TValues>
