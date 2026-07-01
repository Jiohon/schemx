import type {
  RuntimeNodeResourceContext,
  RuntimeNodeId,
} from "./types"
import type { Values } from "../types"

/**
 * 创建 RuntimeNode 之外的领域资源注册表。
 *
 * 资源通过 `RuntimeNodeId` 关联，资源表是事实存储，不承载领域逻辑。
 * 创建逻辑仍留在各领域模块中，调用方在明确边界内直接读写对应 Map。
 */
export function createRuntimeResources<
  TValues extends Values = Values,
>(): RuntimeNodeResourceContext<TValues> {
  return {
    nodes: new Map(),
    descriptors: new Map(),
    fieldStates: new Map(),
    viewStates: new Map(),
    childrenStates: new Map(),
    dependencyEffects: new Map(),
    fieldResourceScopes: new Map(),
    fieldDynamicPropScopes: new Map(),
    dependencyResourceScopes: new Map(),
  }
}

/**
 * 删除某个节点在所有资源表中的记录。
 *
 * 一致性清理 helper：避免调用方在移除节点时遗漏某张资源表。
 * 不负责领域资源自身的 dispose，那由各领域 scope 在卸载时处理。
 */
export function deleteNodeResources<TValues extends Values>(
  resources: RuntimeNodeResourceContext<TValues>,
  nodeId: RuntimeNodeId
): void {
  resources.nodes.delete(nodeId)
  resources.descriptors.delete(nodeId)
  resources.fieldStates.delete(nodeId)
  resources.viewStates.delete(nodeId)
  resources.childrenStates.delete(nodeId)
  resources.dependencyEffects.delete(nodeId)
  resources.fieldResourceScopes.delete(nodeId)
  resources.fieldDynamicPropScopes.delete(nodeId)
  resources.dependencyResourceScopes.delete(nodeId)
}
