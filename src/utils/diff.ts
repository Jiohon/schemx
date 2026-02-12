// ==================== 对象差异工具 ====================

import { isEqual } from "es-toolkit"
import { isObject } from "es-toolkit/compat"

export interface DiffResult<T extends Record<string, any> = Record<string, any>> {
  /** 变化的字段值（key → 新值） */
  changedValues: Partial<T>
  /** 变化的字段名列表 */
  changedFields: string[]
  /** 变化的完整路径列表（支持嵌套，如 "a.b.c"） */
  changedPaths: string[]
}

/**
 * 深比较两个对象，返回变化的字段、值和完整路径
 *
 * @param prevValues - 旧值对象
 * @param newValues - 新值对象
 * @returns changedValues、changedFields 和 changedPaths
 *
 * @example
 * ```typescript
 * const { changedValues, changedFields, changedPaths } = diffValues(
 *   { name: 'a', address: { city: 'BJ', zip: '100' } },
 *   { name: 'b', address: { city: 'SH', zip: '100' } }
 * )
 * // changedValues: { name: 'b', address: { city: 'SH', zip: '100' } }
 * // changedFields: ['name', 'address']
 * // changedPaths: ['name', 'address.city']
 * ```
 */
export function diffValues<T extends Record<string, any>>(
  newValues: T,
  prevValues: T
): DiffResult<T> {
  const changedValues: Partial<T> = {}
  const changedFields: string[] = []
  const changedPaths: string[] = []

  const collectPaths = (
    newObj: Record<string, any>,
    oldObj: Record<string, any>,
    prefix: string
  ) => {
    const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])

    for (const key of keys) {
      const oldVal = oldObj[key]
      const newVal = newObj[key]
      const path = prefix ? `${prefix}.${key}` : key

      if (isEqual(oldVal, newVal)) continue

      // 两边都是纯对象时递归收集子路径
      if (
        isObject(oldVal) &&
        isObject(newVal) &&
        !Array.isArray(oldVal) &&
        !Array.isArray(newVal)
      ) {
        collectPaths(oldVal as Record<string, any>, newVal as Record<string, any>, path)
      } else {
        changedPaths.push(path)
      }
    }
  }

  const keys = new Set([...Object.keys(prevValues), ...Object.keys(newValues)])

  for (const key of keys) {
    if (!isEqual(prevValues[key], newValues[key])) {
      changedFields.push(key)
      ;(changedValues as any)[key] = newValues[key]
    }
  }

  collectPaths(newValues, prevValues, "")

  return { changedValues, changedFields, changedPaths }
}
