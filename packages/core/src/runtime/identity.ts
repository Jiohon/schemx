/**
 * Runtime 节点身份策略。
 *
 * 稳定 key 是增量复用的基础：字段优先用 name，dependency/group 在缺少业务 key
 * 时使用结构信息 + index 兜底。
 *
 * @module core/runtime/identity
 */

import { isDependencySchema, isGroupSchema } from "../utils"

import type { RuntimeSchema, SchemxBaseField, Values } from "../types"

/**
 * 为 owner path 下的 schema 生成稳定 runtime node key。
 *
 * key 生成优先级：
 * 1. 用户显式指定的 `schema.key`
 * 2. dependency: 使用 `to` 字段路径组合
 * 3. group: 使用 label
 * 4. field: 使用 name
 *
 * @typeParam T - 表单值类型
 *
 * @param schema - 运行时 schema
 * @param ownerPath - 所有者路径
 * @param index - schema 在同级中的位置（作为 fallback）
 * @returns 稳定的节点 key
 *
 * @example
 * ```ts
 * // 用户显式 key
 * getRuntimeNodeKey({ key: 'custom-key', ... }, 'root', 0)
 * // → 'root/custom-key'
 *
 * // 字段使用 name
 * getRuntimeNodeKey({ name: 'username', ... }, 'root', 0)
 * // → 'root/field:username'
 *
 * // dependency 使用 to
 * getRuntimeNodeKey({ to: ['type'], renderer: fn }, 'root', 0)
 * // → 'root/dependency:type:0'
 *
 * // group 使用 label
 * getRuntimeNodeKey({ label: '用户信息', children: [...] }, 'root', 0)
 * // → 'root/group:用户信息:0'
 * ```
 */
export function getRuntimeNodeKey<T extends Values>(
  schema: RuntimeSchema<T>,
  ownerPath: string,
  index: number
): string {
  const schemaKey = (schema as { key?: string }).key

  // 用户显式 key 优先，适合业务主动控制复杂动态列表的节点身份。
  if (schemaKey) return `${ownerPath}/${schemaKey}`

  // dependency 使用 to 字段路径组合，保证同 to 配置的节点身份稳定。
  if (isDependencySchema(schema)) {
    return `${ownerPath}/dependency:${schema.to.map((item) => String(item)).join("|")}:${index}`
  }

  // group 使用 label 作为身份标识。
  if (isGroupSchema(schema)) {
    return `${ownerPath}/group:${schema.label}:${index}`
  }

  // field 使用 name 作为身份标识。
  return `${ownerPath}/field:${String((schema as SchemxBaseField<T>).name)}`
}
