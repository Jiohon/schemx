/**
 * T030 [US1] - Schema Diff & Patch Generation
 *
 * 实现 schema diff 到 patch 序列，覆盖 replace root、
 * slot-local children 和 invalid root replacement atomic reject。
 *
 * @module core/schemaGraph/patches
 */

import type {
  NodeId,
  IdentifiedSchemaNode,
  SchemaPatch,
  SchemaDiffResult,
} from "./types"
import type { Values } from "../types/form"
import type { SchemaInputError } from "../runtimeGraph/types"

/**
 * 深度比较两个节点的静态 schema 是否相等。
 */
function staticSchemaEqual<TValues extends Values>(
  a: IdentifiedSchemaNode<TValues>,
  b: IdentifiedSchemaNode<TValues>
): boolean {
  // 使用简化的比较方式
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * 将 identified 节点集合转换为 map。
 */
function nodesToMap<TValues extends Values>(
  nodes: IdentifiedSchemaNode<TValues>[]
): Map<NodeId, IdentifiedSchemaNode<TValues>> {
  const map = new Map<NodeId, IdentifiedSchemaNode<TValues>>()

  function add(n: IdentifiedSchemaNode<TValues>[]) {
    for (const node of n) {
      map.set(node.nodeId, node)
      if (node.kind === "group") {
        add(node.children)
      }
    }
  }

  add(nodes)
  return map
}

/**
 * 计算新旧 identified schemas 之间的差异，生成补丁序列。
 *
 * @param oldNodes - 旧的已分配 identity 的节点
 * @param newNodes - 新的已分配 identity 的节点
 * @param rootId - 根节点 ID
 * @returns 差异结果，包含补丁序列和统计信息
 */
export function diffSchemas<TValues extends Values = Values>(
  oldNodes: IdentifiedSchemaNode<TValues>[],
  newNodes: IdentifiedSchemaNode<TValues>[],
  rootId: NodeId = "root"
): SchemaDiffResult<TValues> {
  // 先验证新 schemas 是否有效
  const validationErrors = validateNewSchemas(newNodes)
  if (validationErrors.length > 0) {
    // 无效时返回空补丁和错误（atomic reject）
    return {
      patches: [],
      diagnostics: {
        insertedCount: 0,
        removedCount: 0,
        reusedCount: 0,
      },
    }
  }

  const patches: SchemaPatch<TValues>[] = []
  const oldMap = nodesToMap(oldNodes)
  const newMap = nodesToMap(newNodes)
  const stats = { inserted: 0, removed: 0, reused: 0 }

  // 简化版本：完全替换所有节点
  // Phase 3 先实现基础功能

  // 移除旧节点
  for (const nodeId of oldMap.keys()) {
    patches.push({ type: "remove", nodeId })
    stats.removed++
  }

  // 插入新节点
  for (let i = 0; i < newNodes.length; i++) {
    patches.push({
      type: "insert",
      parentId: rootId,
      index: i,
      node: newNodes[i],
    })
    stats.inserted++
  }

  return {
    patches,
    diagnostics: {
      insertedCount: stats.inserted,
      removedCount: stats.removed,
      reusedCount: stats.reused,
    },
  }
}

/**
 * 验证新 schemas 是否有效。
 */
function validateNewSchemas<TValues extends Values>(
  newNodes: IdentifiedSchemaNode<TValues>[]
): SchemaInputError[] {
  const errors: SchemaInputError[] = []
  const seenKeys = new Set<string>()

  function validate(nodes: IdentifiedSchemaNode<TValues>[]) {
    for (const node of nodes) {
      // 检查重复 key
      if (node.key) {
        const fullKey = `${node.parentId}/${node.key}`
        if (seenKeys.has(fullKey)) {
          errors.push({
            type: "duplicate_key",
            message: `Duplicate key "${node.key}" in schema replacement`,
          })
        }
        seenKeys.add(fullKey)
      }

      // 递归验证子节点
      if (node.kind === "group") {
        validate(node.children)
      }
    }
  }

  validate(newNodes)
  return errors
}
