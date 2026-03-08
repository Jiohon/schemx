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

import type { FormValues, NamePath, Value } from "../types"

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
 * 从对象中递归收集所有路径（包括中间节点和叶子节点）
 *
 * 对于嵌套的纯对象和数组，同时收集自身路径和递归展开的子路径。
 * - 纯对象：按 key 展开，路径用 `.` 连接
 * - 数组：按索引展开，路径用 `[index]` 连接
 * - 其他值（string、number、null 等）：视为叶子节点
 *
 * @param obj - 要收集路径的对象
 * @param prefix - 路径前缀（内部递归用）
 * @returns 所有路径数组（包括中间节点）
 *
 * @example
 * ```typescript
 * collectObjectPaths({ name: 'a', age: 25 })
 * // => ['name', 'age']
 *
 * collectObjectPaths({ name: 'a', address: { city: 'BJ', zip: '100000' } })
 * // => ['name', 'address', 'address.city', 'address.zip']
 *
 * collectObjectPaths({ tags: [1, 2] })
 * // => ['tags', 'tags[0]', 'tags[1]']
 * ```
 */
export function collectObjectPaths(obj: Record<string, any>, prefix = ""): NamePath[] {
  const paths: NamePath[] = []

  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    const value = obj[key]

    if (Array.isArray(value)) {
      paths.push(path)
      value.forEach((item, index) => {
        const itemPath = `${path}[${index}]`
        if (item !== null && typeof item === "object") {
          paths.push(itemPath)
          paths.push(...collectObjectPaths(item, itemPath))
        } else {
          paths.push(itemPath)
        }
      })
    } else if (value !== null && typeof value === "object") {
      paths.push(path)
      paths.push(...collectObjectPaths(value, path))
    } else {
      paths.push(path)
    }
  }

  return paths
}

/**
 * 从源对象中按路径集合提取子集
 *
 * @param source - 源对象
 * @param paths - 要提取的路径集合
 * @returns 包含指定路径值的部分对象
 *
 * @example
 * ```typescript
 * const obj = { name: 'John', age: 25, city: 'Beijing' }
 * pickByPaths(obj, new Set(['name', 'age']))
 * // => { name: 'John', age: 25 }
 * ```
 */
export function pickByPaths<T extends FormValues>(
  source: Record<string, any>,
  paths: Set<NamePath<T>>
): Partial<T> {
  const result: Partial<T> = {}
  for (const path of paths) {
    ;(result as any)[path] = getByPath(source, path)
  }

  return result
}
