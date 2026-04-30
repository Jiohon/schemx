/**
 * 路径工具函数
 *
 * 基于 es-toolkit/compat 的路径操作，提供嵌套路径的解析和设置功能。
 * 支持点号分隔的路径格式（如 `user.address.city`）和数组路径格式。
 *
 * @module utils/path
 *
 * @example
 * ```typescript
 * import { getByPath, setByPath } from './path'
 *
 * const obj = { user: { address: { city: 'Beijing' } } }
 *
 * // 获取嵌套值
 * getByPath(obj, 'user.address.city') // => 'Beijing'
 *
 * // 设置嵌套值（会自动创建中间对象）
 * setByPath(obj, 'user.profile.name', 'John')
 * // obj => { user: { address: { city: 'Beijing' }, profile: { name: 'John' } } }
 * ```
 */

import { get, set } from "es-toolkit/compat"

import type { NamePath, Value, Values } from "../types"

/**
 * 从对象中根据路径获取嵌套值
 *
 * @param obj - 要获取值的源对象
 * @param path - NamePath 路径（string / number / array）
 * @returns 路径对应的值，如果路径不存在则返回 undefined
 */
export function getByPath(obj: Values, path: NamePath): Value {
  if (path === "" || (Array.isArray(path) && path.length === 0)) return obj

  return get(obj, path)
}

/**
 * 在对象中根据路径设置嵌套值
 *
 * @param obj - 要设置值的目标对象
 * @param path - NamePath 路径（string / number / array）
 * @param value - 要设置的值
 */
export function setByPath(obj: Values, path: NamePath, value: Value): void {
  if (obj == null) return

  set(obj, path, value)
}

/**
 * 从对象中递归收集所有叶子节点路径。
 *
 * 只返回叶子路径，不包含中间对象/数组节点。
 *
 * @param obj - 要收集路径的对象
 * @param prefix - 路径前缀（内部递归用）
 * @returns 所有叶子节点路径数组
 *
 * @example
 * ```typescript
 * collectObjectPathsByLeaf({ name: 'a', age: 25 })
 * // => ['name', 'age']
 *
 * collectObjectPathsByLeaf({ name: 'a', address: { city: 'BJ', zip: '100000' } })
 * // => ['name', 'address.city', 'address.zip']
 * ```
 */
export function collectObjectPathsByLeaf<T extends NamePath>(
  obj: Record<string, any>,
  prefix = ""
): T[] {
  const paths: T[] = []

  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    const value = obj[key]

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const itemPath = `${path}[${index}]` as T
        if (item !== null && typeof item === "object") {
          paths.push(...(collectObjectPathsByLeaf(item, itemPath) as T[]))
        } else {
          paths.push(itemPath)
        }
      })
    } else if (value !== null && typeof value === "object") {
      paths.push(...(collectObjectPathsByLeaf(value, path) as T[]))
    } else {
      paths.push(path as T)
    }
  }

  return paths
}
