/**
 * Schema 规范化阶段。
 *
 * 编译前先复制 schema，保证 runtime 后续不会原地修改用户传入的 raw schema。
 *
 * @module core/runtime/normalize
 */

import { isGroupSchema } from "../utils"

import type { SchemxField, Values } from "../types"

/**
 * 通过浅拷贝创建 runtime 输入，并递归规范化 group children。
 */
export function normalizeSchemas<T extends Values>(
  schemas: SchemxField<T>[]
): SchemxField<T>[] {
  return schemas.map((schema) => {
    if (isGroupSchema(schema)) {
      return {
        ...schema,
        children: normalizeSchemas(schema.children as SchemxField<T>[]),
      } as SchemxField<T>
    }

    return { ...schema } as SchemxField<T>
  })
}
