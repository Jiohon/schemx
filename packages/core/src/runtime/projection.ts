/**
 * Runtime tree 投影工具。
 *
 * Runtime 内部节点带有 signal、effect 释放函数等运行时状态；框架适配层
 * 只需要普通 schema 对象，因此这里负责把 runtime tree 转成已解析 schema 列表。
 *
 * @module core/runtime/projection
 */

import type { SchemxResolvedField, Values } from "../types"
import { readFieldRuntimeProps } from "./fieldRuntime"

import type { SchemxResolvedBaseField } from "../types"
import type { FieldRuntimeNode, RuntimeNode } from "./types"

export function projectFieldNode<T extends Values>(
  node: FieldRuntimeNode<T>
): SchemxResolvedBaseField<T> {
  return {
    // 原始 schema 保持不可变，已解析属性只覆盖到投影视图里。
    ...node.schema,
    ...readFieldRuntimeProps(node.field),
    key: node.key,
  }
}

/**
 * 将 runtime 节点投影为适配层消费的已解析 schema 列表。
 *
 * dependency 节点本身不出现在 projection 中，只展开它 renderer 产出的 children。
 */
export function projectRuntimeNodes<T extends Values>(
  nodes: RuntimeNode<T>[]
): SchemxResolvedField<T>[] {
  const result: SchemxResolvedField<T>[] = []

  for (const node of nodes) {
    if (node.type === "field") {
      result.push(projectFieldNode(node))
    } else if (node.type === "group") {
      result.push({
        ...node.schema,
        children: projectRuntimeNodes(node.children),
        key: node.key,
      })
    } else if (node.children.length > 0) {
      result.push(...projectRuntimeNodes(node.children))
    }
  }

  return result
}
