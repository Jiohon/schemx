/**
 * Schema 静态校验阶段。
 *
 * 这里只做无副作用的结构检查，不创建 signal、不注册 effect、不执行 renderer。
 *
 * @module core/runtime/staticValidate
 */

import { isDependencySchema, isGroupSchema } from "../utils"

import type { SchemxField, Values } from "../types"

/**
 * 校验 dependency 形状，并对重复字段名给出警告。
 */
export function staticValidateSchemas<T extends Values>(
  schemas: SchemxField<T>[],
  seen = new Set<string>()
): void {
  for (const schema of schemas) {
    if (isDependencySchema(schema)) {
      if (!Array.isArray(schema.to) || typeof schema.renderer !== "function") {
        throw new Error("[schemx] Invalid dependency schema")
      }

      continue
    }

    if (isGroupSchema(schema)) {
      staticValidateSchemas(schema.children as SchemxField<T>[], seen)
      continue
    }

    const name = String(schema.name)

    if (seen.has(name)) {
      console.warn(`[schemx] duplicate field name: ${name}`)
    }

    seen.add(name)
  }
}
