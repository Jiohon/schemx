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

import type { FormValues, NamePath, Value } from "@schemx/core"

/**
 * 从对象中根据路径获取嵌套值
 *
 * @param obj - 要获取值的源对象
 * @param path - NamePath 路径（string / number / array）
 * @returns 路径对应的值，如果路径不存在则返回 undefined
 */
export function getByPath(obj: FormValues, path: NamePath): Value {
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
export function setByPath(obj: FormValues, path: NamePath, value: Value): void {
  if (obj == null) return

  set(obj, path, value)
}

/**
 * 从对象中递归收集所有叶子节点路径。
 *
 * 与 collectObjectPaths 不同，此函数只返回叶子路径，不包含中间对象/数组节点。
 * - 纯对象：递归展开，只收集最终的非对象值路径
 * - 数组：按索引展开，元素为对象时继续递归，否则收集该索引路径
 * - 其他值（string、number、null 等）：视为叶子节点直接收集
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
 *
 * collectObjectPathsByLeaf({ tags: [1, 2] })
 * // => ['tags[0]', 'tags[1]']
 *
 * collectObjectPathsByLeaf({ matrix: [[1, 2], [3]] })
 * // => ['matrix[0][0]', 'matrix[0][1]', 'matrix[1][0]']
 * ```
 */
export function collectObjectPathsByLeaf(
  obj: Record<string, any>,
  prefix = ""
): NamePath[] {
  const paths: NamePath[] = []

  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    const value = obj[key]

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const itemPath = `${path}[${index}]`
        if (item !== null && typeof item === "object") {
          paths.push(...collectObjectPathsByLeaf(item, itemPath))
        } else {
          paths.push(itemPath)
        }
      })
    } else if (value !== null && typeof value === "object") {
      paths.push(...collectObjectPathsByLeaf(value, path))
    } else {
      paths.push(path)
    }
  }

  return paths
}
