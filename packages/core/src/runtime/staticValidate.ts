/**
 * Schema 静态校验阶段。
 *
 * 这里只做无副作用的结构检查，不创建 signal、不注册 effect、不执行 renderer。
 * 这是编译管道的第二步，在规范化之后、增量对账之前执行。
 *
 * @module core/runtime/staticValidate
 */

import { isDependencySchema, isGroupSchema } from "../utils"

import type { SchemxField, Values } from "../types"

/**
 * 校验 dependency 形状，并对重复字段名给出警告。
 *
 * 校验规则：
 * 1. dependency schema 必须有有效的 `to` 和 `renderer`
 * 2. 同一作用域内不应有重复的字段名（警告，不阻止）
 *
 * 注意：校验错误会抛出异常，警告仅打印日志。
 *
 * @typeParam T - 表单值类型
 *
 * @param schemas - 要校验的 schema 列表
 * @param seen - 已见过的字段名集合（用于检测重复）
 *
 * @throws 如果 dependency schema 无效
 *
 * @example
 * ```ts
 * // 正常 schema
 * staticValidateSchemas([
 *   { name: 'username', label: '用户名' },
 *   { name: 'password', label: '密码' }
 * ])
 *
 * // 无效 dependency（会抛错）
 * staticValidateSchemas([
 *   { to: 'invalid', renderer: 'not a function' }
 * ])
 *
 * // 重复字段名（仅警告）
 * staticValidateSchemas([
 *   { name: 'field', label: '字段1' },
 *   { name: 'field', label: '字段2' }
 * ])
 * // → [schemx] duplicate field name: field
 * ```
 */
export function staticValidateSchemas<T extends Values>(
  schemas: SchemxField<T>[],
  seen = new Set<string>()
): void {
  for (const schema of schemas) {
    // dependency schema 校验：必须有 array 类型的 to 和 function 类型的 renderer。
    if (isDependencySchema(schema)) {
      if (!Array.isArray(schema.to) || typeof schema.renderer !== "function") {
        throw new Error("[schemx] Invalid dependency schema")
      }

      // dependency 没有字段名，跳过重复检测。
      continue
    }

    // group schema 递归校验 children。
    if (isGroupSchema(schema)) {
      staticValidateSchemas(schema.children as SchemxField<T>[], seen)
      continue
    }

    // 普通字段：检测重复字段名。
    const name = String(schema.name)

    if (seen.has(name)) {
      // 重复字段名只警告，不阻止编译。
      // 这可能是业务有意为之（如条件渲染的同名字段）。
      console.warn(`[schemx] duplicate field name: ${name}`)
    }

    seen.add(name)
  }
}
