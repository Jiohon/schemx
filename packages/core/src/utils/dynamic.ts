/**
 * 动态属性解析工具
 *
 * 支持将函数类型或静态值统一解析为最终属性值，
 * 用于 schemx 列配置中的动态属性（如 disabled、hidden、placeholder 等）。
 *
 * @module utils/dynamic
 */

import type { FormValues } from "../types"

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
export type Dynamic<T, V extends FormValues = FormValues> =
  | ((values: V) => T | Promise<T>)
  | T

/**
 * 解析泛型动态属性
 *
 * 将 `Dynamic<T>`（函数或静态值）统一解析为 `T`。
 * 当 value 为函数时调用并传入表单值，捕获错误返回默认值；
 * 当 value 为 null/undefined 时返回默认值。
 *
 * @typeParam T - 解析后的属性值类型
 *
 * @param value - 动态属性值（函数、静态值、null 或 undefined）
 * @param formValues - 当前表单值，作为函数形式的入参
 * @param defaultValue - 默认值，当 value 为空或函数返回 nullish 时使用
 *
 * @returns 解析后的属性值，类型始终为 T
 *
 * @example
 * ```typescript
 * // 函数类型
 * await resolveDynamicProp((v) => v.name, { name: 'test' }, '')
 * // => 'test'
 *
 * // 静态值
 * await resolveDynamicProp('hello', {}, '')
 * // => 'hello'
 *
 * // null/undefined 回退到默认值
 * await resolveDynamicProp(undefined, {}, 'default')
 * // => 'default'
 * ```
 */
export async function resolveDynamicProp<T>(
  value: Dynamic<T> | undefined | null,
  formValues: FormValues,
  defaultValue: T
): Promise<T> {
  if (value == null) {
    return defaultValue
  }

  if (typeof value === "function") {
    try {
      const result = await (value as (values: FormValues) => T | Promise<T>)(formValues)

      return result ?? defaultValue
    } catch (error) {
      console.error("[SchemaRenderer] Error evaluating dynamic prop:", error)

      return defaultValue
    }
  }

  return value
}
