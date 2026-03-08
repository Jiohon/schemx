/**
 * 动态属性解析工具
 *
 * 支持将函数类型或静态值统一解析为最终属性值，
 * 用于 SchemaForm 列配置中的动态属性（如 disabled、hidden、placeholder 等）。
 *
 * @module utils/dynamic
 */

import type { DynamicProp, FormValues } from "../types"

/**
 * 解析布尔类型的动态属性
 *
 * 支持函数类型和静态值：
 * - 函数：调用并传入表单值，捕获错误返回默认值
 * - 静态值：直接返回
 * - null/undefined：返回默认值
 *
 * @param value - 动态属性值（函数或静态布尔值）
 * @param formValues - 当前表单值
 * @param defaultValue - 默认值，默认 `false`
 * @returns 解析后的布尔值
 *
 * @example
 * ```typescript
 * await resolveDynamicPropByBoolean((v) => v.age > 18, { age: 20 }, false)
 * // => true
 *
 * await resolveDynamicPropByBoolean(true, {}, false)
 * // => true
 *
 * await resolveDynamicPropByBoolean(undefined, {}, false)
 * // => false
 * ```
 */
export async function resolveDynamicPropByBoolean(
  value: DynamicProp<boolean> | undefined | null,
  formValues: FormValues,
  defaultValue: boolean | undefined = false
): Promise<boolean> {
  if (value == null) {
    return defaultValue
  }

  if (typeof value === "function") {
    try {
      const result = await value(formValues)

      return result ? result : defaultValue
    } catch (error) {
      console.error("[SchemaRenderer] Error evaluating dynamic prop:", error)

      return defaultValue
    }
  }

  return value
}

/**
 * 解析泛型动态属性
 *
 * 支持函数类型和静态值：
 * - 函数：调用并传入表单值，捕获错误返回默认值
 * - 静态值：直接返回
 * - null/undefined：返回默认值
 *
 * @typeParam T - 属性值类型
 *
 * @param value - 动态属性值（函数或静态值）
 * @param formValues - 当前表单值
 * @param defaultValue - 默认值
 * @returns 解析后的属性值
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
 * // null/undefined
 * await resolveDynamicProp(undefined, {}, 'default')
 * // => 'default'
 * ```
 */
export async function resolveDynamicProp<T>(
  value: DynamicProp<T> | T | undefined | null,
  formValues: FormValues,
  defaultValue: T
): Promise<T> {
  if (value == null) {
    return defaultValue
  }

  if (typeof value === "function") {
    try {
      const result = await (value as (values: FormValues) => T)(formValues)

      return result ?? defaultValue
    } catch (error) {
      console.error("[SchemaRenderer] Error evaluating dynamic prop:", error)

      return defaultValue
    }
  }

  return value
}
