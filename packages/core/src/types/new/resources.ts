/**
 * Runtime resources - RuntimeNode 之外的领域资源注册表。
 *
 * RuntimeNode 只表达结构和生命周期根；descriptor、field state、view state、
 * dependency effect 等领域资源通过 node id 关联，避免结构节点继续膨胀。
 *
 * @module core/runtime-resources
 */

import type { FormDescriptor } from "../../descriptor/types"
import type { RuntimeChildrenState } from "./runtimeNode"
import type { Scope } from "./scope"

import type { DependencyEffectState } from "../../field/dependencyEffect"
import type { FieldRuntimeState } from "../../field/runtimeState"
import type { RuntimeViewState } from "../../view/viewGraph"

import type { Values } from ".."
import type { RuntimeNode, RuntimeNodeId } from "./runtimeNode"

/**
 * 运行时资源注册表。
 *
 * 所有 Map 都以 `RuntimeNodeId` 为 key。字段、分组、dependency 的资源
 * 按领域分表保存，调用方应先通过 node type 决定读取哪一类资源。
 */
export interface RuntimeNodeResourceContext<TValues extends Values = Values> {
  /** RuntimeNode 结构事实源。 */
  readonly nodes: Map<RuntimeNodeId, RuntimeNode<TValues>>

  /** 非 root 节点对应的 descriptor。 */
  readonly descriptors: Map<RuntimeNodeId, FormDescriptor<TValues>>

  /** field node 的字段运行态。 */
  readonly fieldStates: Map<RuntimeNodeId, FieldRuntimeState<TValues>>

  /** root、field、group、dependency 的视图状态。 */
  readonly viewStates: Map<RuntimeNodeId, RuntimeViewState<TValues>>

  /** root、group、dependency 的 children 响应式状态。 */
  readonly childrenStates: Map<RuntimeNodeId, RuntimeChildrenState<TValues>>

  /** dependency node 的 effect 执行态。 */
  readonly dependencyEffects: Map<RuntimeNodeId, DependencyEffectState>

  /** field 主体资源 scope，例如注册表、校验 effect。 */
  readonly fieldResourceScopes: Map<RuntimeNodeId, Scope>

  /** field dynamic props 资源 scope，例如 dependencies effect。 */
  readonly fieldDynamicPropScopes: Map<RuntimeNodeId, Scope>

  /** dependency renderer、trigger 订阅和 abort 资源 scope。 */
  readonly dependencyResourceScopes: Map<RuntimeNodeId, Scope>
}

/**
 * 创建空资源注册表所需的结构。
 */
export type RuntimeNodeResourceMaps<TValues extends Values = Values> = {
  [K in keyof RuntimeNodeResourceContext<TValues>]: RuntimeNodeResourceContext<TValues>[K]
}
