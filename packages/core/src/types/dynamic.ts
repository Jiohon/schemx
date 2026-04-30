/**
 * 动态属性解析类型
 *
 * @module types/dynamic
 */

import type { Values } from "./form"

/**
 * 动态属性类型
 *
 * 支持静态值或函数形式，函数接收当前表单值并返回属性值（支持异步）。
 *
 * @typeParam T - 属性值类型
 *
 * @example
 * ```ts
 * // 静态值
 * const prop: Dynamic<boolean> = true
 *
 * // 动态函数
 * const prop: Dynamic<boolean> = (values) => values.age > 18
 * ```
 */
export type Dynamic<T, V extends Values = Values> = ((values: V) => T | Promise<T>) | T
