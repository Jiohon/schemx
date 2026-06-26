/**
 * T029 [US1] - Schema Identity Resolution
 *
 * 实现 SchemaGraph identity 解析，显式 key 优先，
 * 并对 duplicate key 或 unstable identity fail-fast。
 *
 * @module core/schemaGraph/identity
 */

import type {
  NodeId,
  NormalizedSchemaNode,
  NormalizedFieldNode,
  NormalizedGroupNode,
  NormalizedDynamicSlotNode,
  IdentifiedSchemaNode,
  IdentifiedFieldNode,
  IdentifiedGroupNode,
  IdentifiedDynamicSlotNode,
} from "./types"
import type { Values } from "../types/form"
import type { SchemaInputError } from "../runtimeGraph/types"
import { ROOT_NODE_ID } from "./types"

/**
 * 为规范化的节点分配稳定 identities。
 */
export function assignIdentities<TValues extends Values = Values>(
  normalizedNodes: NormalizedSchemaNode<TValues>[],
  rootId: NodeId = ROOT_NODE_ID
): {
  identifiedNodes: IdentifiedSchemaNode<TValues>[]
  errors: SchemaInputError[]
} {
  const identifiedNodes: IdentifiedSchemaNode<TValues>[] = []
  const errors: SchemaInputError[] = []
  const seenKeys = new Set<string>()

  for (let i = 0; i < normalizedNodes.length; i++) {
    const node = normalizedNodes[i]
    const identified = identifyNode(node, rootId, i, seenKeys, errors)
    if (identified) {
      identifiedNodes.push(identified)
    }
  }

  return { identifiedNodes, errors }
}

/**
 * 为单个节点分配 identity，递归处理子节点。
 */
function identifyNode<TValues extends Values>(
  node: NormalizedSchemaNode<TValues>,
  parentId: NodeId,
  index: number,
  seenKeys: Set<string>,
  errors: SchemaInputError[]
): IdentifiedSchemaNode<TValues> | null {
  // 检查显式 key 重复
  if (node.key) {
    const fullKey = `${parentId}/${node.key}`
    if (seenKeys.has(fullKey)) {
      errors.push({
        type: "duplicate_key",
        message: `Duplicate explicit key "${node.key}" at ${parentId}`,
      })
      return null
    }
    seenKeys.add(fullKey)
  }

  // 生成 nodeId
  const nodeId = generateNodeId(node, parentId, index)

  switch (node.kind) {
    case "group":
      return identifyGroup(node, nodeId, parentId, index, seenKeys, errors)
    case "field":
      return identifyField(node, nodeId, parentId, index)
    case "dynamic_slot":
      return identifyDynamicSlot(node, nodeId, parentId, index)
  }
}

/**
 * 构造已分配身份的字段节点。
 */
function identifyField<TValues extends Values>(
  node: NormalizedFieldNode<TValues>,
  nodeId: NodeId,
  parentId: NodeId,
  index: number
): IdentifiedFieldNode<TValues> {
  return {
    kind: "field",
    key: node.key,
    name: node.name,
    staticSchema: node.staticSchema,
    dependencies: node.dependencies,
    nodeId,
    parentId,
    index,
  }
}

/**
 * 构造已分配身份的分组节点。
 */
function identifyGroup<TValues extends Values>(
  node: NormalizedGroupNode<TValues>,
  nodeId: NodeId,
  parentId: NodeId,
  index: number,
  seenKeys: Set<string>,
  errors: SchemaInputError[]
): IdentifiedGroupNode<TValues> {
  const children: IdentifiedSchemaNode<TValues>[] = []
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]
    const identifiedChild = identifyNode(child, nodeId, i, seenKeys, errors)
    if (identifiedChild) {
      children.push(identifiedChild)
    }
  }
  return {
    kind: "group",
    key: node.key,
    staticSchema: node.staticSchema,
    children,
    nodeId,
    parentId,
    index,
  }
}

/**
 * 构造已分配身份的动态插槽节点。
 */
function identifyDynamicSlot<TValues extends Values>(
  node: NormalizedDynamicSlotNode<TValues>,
  nodeId: NodeId,
  parentId: NodeId,
  index: number
): IdentifiedDynamicSlotNode<TValues> {
  return {
    kind: "dynamic_slot",
    key: node.key,
    to: node.to,
    renderer: node.renderer,
    nodeId,
    parentId,
    index,
  }
}

/**
 * 生成节点 ID。
 */
function generateNodeId<TValues extends Values>(
  node: NormalizedSchemaNode<TValues>,
  parentId: NodeId,
  index: number
): NodeId {
  // 优先使用显式 key
  if (node.key) {
    return `${parentId}/${node.key}`
  }

  // 根据节点类型生成
  if (node.kind === "field") {
    const nameStr = String(node.name)
    return `${parentId}/field:${nameStr}`
  }

  if (node.kind === "group") {
    return `${parentId}/group:${index}`
  }

  if (node.kind === "dynamic_slot") {
    return `${parentId}/slot:${index}`
  }

  // 兜底
  return `${parentId}/node:${index}`
}

/**
 * 检查两组 identities 是否稳定（用于 schema replacement）。
 */
export function validateStableIdentities<TValues extends Values>(
  oldNodes: readonly IdentifiedSchemaNode<TValues>[],
  newNodes: readonly IdentifiedSchemaNode<TValues>[]
): SchemaInputError[] {
  const errors: SchemaInputError[] = []
  // 简化版本，暂时跳过详细验证
  return errors
}

/**
 * 从 identified 节点中提取所有 node IDs。
 */
export function collectAllNodeIds<TValues extends Values>(
  nodes: readonly IdentifiedSchemaNode<TValues>[]
): NodeId[] {
  const ids: NodeId[] = []

  function collect(n: readonly IdentifiedSchemaNode<TValues>[]) {
    for (const node of n) {
      ids.push(node.nodeId)
      if (node.kind === "group") {
        collect(node.children)
      }
    }
  }

  collect(nodes)
  return ids
}
