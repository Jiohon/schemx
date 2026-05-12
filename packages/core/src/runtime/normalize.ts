/**
 * Schema 规范化阶段。
 *
 * 编译前先复制 schema，保证 runtime 后续不会原地修改用户传入的 raw schema。
 * 这是编译管道的第一步，后续的静态校验和增量对账都基于规范化后的副本。
 *
 * @module core/runtime/normalize
 */

import { isGroupSchema } from "../utils"

import type { SchemxField, Values } from "../types"

/**
 * 通过浅拷贝创建 runtime 输入，并递归规范化 group children。
 *
 * 规范化的目的是：
 * 1. 避免修改用户传入的原始 schema
 * 2. 为后续编译阶段提供可修改的副本
 *
 * 注意：只做浅拷贝，嵌套对象（如 componentProps）仍为引用。
 * 如需深拷贝，应在调用方自行处理。
 *
 * @typeParam T - 表单值类型
 *
 * @param schemas - 原始 schema 列表
 * @returns 规范化后的 schema 副本
 *
 * @example
 * ```ts
 * const rawSchemas = [
 *   { name: 'username', label: '用户名' },
 *   { componentType: 'group', label: '信息', children: [...] }
 * ]
 *
 * const normalized = normalizeSchemas(rawSchemas)
 * // normalized 是 rawSchemas 的浅拷贝
 * // 修改 normalized 不会影响 rawSchemas
 * ```
 */
export function normalizeSchemas<T extends Values>(
  schemas: SchemxField<T>[]
): SchemxField<T>[] {
  return schemas.map((schema) => {
    // group 需要递归规范化 children。
    if (isGroupSchema(schema)) {
      return {
        ...schema,
        children: normalizeSchemas(schema.children as SchemxField<T>[]),
      } as SchemxField<T>
    }

    // 非 group 直接浅拷贝。
    return { ...schema } as SchemxField<T>
  })
}
