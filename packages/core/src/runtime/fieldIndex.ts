/**
 * Runtime 字段 schema 查询索引。
 *
 * createForm.registerRules 等字段级逻辑需要拿到当前 runtime projection 中的
 * 最新 schema 上下文，这里按 name path 建立只包含基础字段的索引。
 *
 * @module core/runtime/fieldIndex
 */

import { projectFieldNode } from "./projection"

import type { NamePath, SchemxResolvedBaseField, Values } from "../types"
import type { RuntimeNode } from "./types"

/**
 * 从 runtime tree 建立只包含基础字段的 schema 索引。
 */
export function buildRuntimeFieldIndex<T extends Values>(
  nodes: RuntimeNode<T>[]
): Map<string, SchemxResolvedBaseField<T>> {
  const result = new Map<string, SchemxResolvedBaseField<T>>()
  collectFieldSchemas(nodes, result)

  return result
}

/**
 * 规范化字段路径，保证 "user.name" 与数组路径能落到同一个索引键。
 */
export function normalizeNamePath<T extends Values>(path: NamePath<T>): string {
  if (Array.isArray(path)) {
    return path.map((part) => String(part)).join(".")
  }

  return String(path)
    .replace(/\[(.*?)\]/g, ".$1")
    .replace(/^\./, "")
}

function collectFieldSchemas<T extends Values>(
  nodes: RuntimeNode<T>[],
  result: Map<string, SchemxResolvedBaseField<T>>
): void {
  for (const node of nodes) {
    if (node.type === "field") {
      // 索引用 projection 后的 schema，确保 dynamic props/rules 是最新值。
      const schema = projectFieldNode(node)

      result.set(normalizeNamePath(schema.name), schema)
    } else if (node.type === "group" || node.children.length > 0) {
      collectFieldSchemas(node.children, result)
    }
  }
}
