/**
 * Runtime resolved schema 工具。
 *
 * RuntimeNode 树包含 signal、runner、disposeBag 等运行时状态；业务侧和
 * adapter 更常消费的是普通 resolved schema。这里集中处理：
 *
 * - 将 RuntimeNode 转为 resolved schema list
 * - 按字段路径建立 resolved field schema 查询索引
 *
 * @module utils/runtimeSchema
 */

import { readFieldProps } from "../runtime"

import { normalizeNamePath } from "./path"

import type {
  NamePath,
  SchemxResolvedBaseField,
  SchemxResolvedField,
  Values,
} from "../types"
import type { FieldRuntimeNode, RuntimeNode } from "../types"

/**
 * 将字段 runtime node 转成适配层可消费的 resolved field schema。
 *
 * 原始 schema 保持不可变；动态属性只覆盖到返回的 resolved schema 视图里。
 */
export function createResolvedFieldSchema<T extends Values>(
  node: FieldRuntimeNode<T>
): SchemxResolvedBaseField<T> {
  return {
    ...node.schema,
    ...readFieldProps(node.fieldRuntime),
    key: node.key,
  }
}

/**
 * 将 runtime tree 转成 resolved schema 列表。
 *
 * 规则：
 * - field 节点输出 resolved field schema
 * - group 节点输出 resolved group schema，并递归转换 children
 * - dependency 节点本身不输出，只展开当前已提交 children
 */
export function createResolvedSchemaList<T extends Values>(
  nodes: RuntimeNode<T>[]
): SchemxResolvedField<T>[] {
  const result: SchemxResolvedField<T>[] = []

  for (const node of nodes) {
    if (node.type === "field") {
      result.push(createResolvedFieldSchema(node))
    } else if (node.type === "group") {
      result.push({
        ...node.schema,
        children: createResolvedSchemaList(node.children),
        key: node.key,
      })
    } else if (node.children.length > 0) {
      result.push(...createResolvedSchemaList(node.children))
    }
  }

  return result
}

/**
 * 从 runtime tree 建立只包含基础字段的 resolved schema 索引。
 *
 * createForm.registerRules 等字段级逻辑需要拿到当前 runtime tree 中的最新
 * schema 上下文，因此索引中保存的是 resolved field schema，而不是 raw schema。
 */
export function buildRuntimeFieldSchemaIndex<T extends Values>(
  nodes: RuntimeNode<T>[]
): Map<string, SchemxResolvedBaseField<T>> {
  const result = new Map<string, SchemxResolvedBaseField<T>>()
  collectFieldSchemas(nodes, result)

  return result
}

function collectFieldSchemas<T extends Values>(
  nodes: RuntimeNode<T>[],
  result: Map<string, SchemxResolvedBaseField<T>>
): void {
  for (const node of nodes) {
    if (node.type === "field") {
      const schema = createResolvedFieldSchema(node)

      result.set(normalizeNamePath(schema.name as NamePath<T>), schema)
    } else if (node.type === "group" || node.children.length > 0) {
      collectFieldSchemas(node.children, result)
    }
  }
}
