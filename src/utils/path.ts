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

import { get, set, has, unset } from "es-toolkit/compat"

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
 * 检查路径是否为有效的嵌套路径格式
 *
 * 有效的路径应该是非空字符串，可以包含点号分隔的多个部分。
 * 每个部分应该是有效的对象属性名。
 *
 * @param path - 要检查的路径字符串
 * @returns 是否为有效路径
 *
 * @example
 * ```typescript
 * isValidPath('user.name')        // => true
 * isValidPath('user.address.city') // => true
 * isValidPath('name')             // => true
 * isValidPath('')                 // => false
 * isValidPath('.')                // => false
 * isValidPath('user..name')       // => false
 * ```
 */
export function isValidPath(path: string): boolean {
  if (typeof path !== "string" || path === "") {
    return false
  }

  const keys = path.split(".")

  return keys.every((key) => key.length > 0)
}

/**
 * 检查对象中是否存在指定路径
 *
 * @param obj - 要检查的对象
 * @param path - 点号分隔的路径字符串
 * @returns 路径是否存在
 *
 * @example
 * ```typescript
 * const obj = { user: { name: 'John', address: null } }
 *
 * hasPath(obj, 'user.name')      // => true
 * hasPath(obj, 'user.address')   // => true (值为 null 但路径存在)
 * hasPath(obj, 'user.age')       // => false
 * hasPath(obj, 'user.profile.bio') // => false
 * ```
 */
export function hasPath(obj: any, path: string): boolean {
  if (path === "") return true

  return has(obj, path)
}

/**
 * 删除对象中指定路径的值
 *
 * @param obj - 要操作的对象
 * @param path - 点号分隔的路径字符串
 * @returns 是否成功删除
 *
 * @example
 * ```typescript
 * const obj = { user: { name: 'John', age: 25 } }
 *
 * deleteByPath(obj, 'user.age')  // => true, obj => { user: { name: 'John' } }
 * deleteByPath(obj, 'user.bio')  // => false (路径不存在)
 * ```
 */
export function deleteByPath(obj: any, path: string): boolean {
  if (path === "" || obj == null) return false

  return unset(obj, path)
}

/**
 * 判断 candidate 是否是 path 的子路径
 *
 * @param path - 父路径
 * @param candidate - 候选路径
 * @returns 是否为子路径
 *
 * @example
 * ```typescript
 * isChildPath('user', 'user.name')           // => true
 * isChildPath('user', 'user.address.city')   // => true
 * isChildPath('user', 'user')                // => false
 * isChildPath('user', 'username')            // => false
 * ```
 */
export function isChildPath(path: string, candidate: string): boolean {
  return candidate.startsWith(path + ".")
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
