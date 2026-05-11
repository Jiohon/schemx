/**
 * Runtime 节点身份策略。
 *
 * 稳定 key 是增量复用的基础：字段优先用 name，dependency/group 在缺少业务 key
 * 时使用结构信息 + index 兜底。
 *
 * @module core/compiler/identity
 */

import { isDependencySchema, isGroupSchema } from "../utils"

import type { RuntimeSchema } from "../runtime/types"
import type { SchemxBaseField, Values } from "../types"

/**
 * 为 owner path 下的 schema 生成稳定 runtime node key。
 */
export function getRuntimeNodeKey<T extends Values>(
  schema: RuntimeSchema<T>,
  ownerPath: string,
  index: number
): string {
  const schemaKey = (schema as { key?: string }).key

  // 用户显式 key 优先，适合业务主动控制复杂动态列表的节点身份。
  if (schemaKey) return `${ownerPath}/${schemaKey}`

  if (isDependencySchema(schema)) {
    return `${ownerPath}/dependency:${schema.to.map((item) => String(item)).join("|")}:${index}`
  }

  if (isGroupSchema(schema)) {
    return `${ownerPath}/group:${schema.label}:${index}`
  }

  return `${ownerPath}/field:${String((schema as SchemxBaseField<T>).name)}`
}
