/**
 * 依赖对象解析工具
 *
 * 提供条件函数执行和错误处理的纯函数。
 *
 * @module utils/dependency
 */

import type { SchemxConditionFn, SchemxInstance, Values } from "@schemx/core"

/**
 * 执行单个属性的条件函数并解析结果
 *
 * 支持同步和异步条件函数。当条件函数抛出异常时捕获错误并记录日志，
 * 回退到默认值；当返回 nullish 值（null 或 undefined）时同样使用默认值。
 *
 * @typeParam R - 条件函数的返回值类型
 *
 * @param condition - 条件函数，接收表单值，返回同步值或 Promise
 * @param formValues - 当前表单值
 * @param defaultValue - 回退默认值，在异常或 nullish 返回时使用
 *
 * @returns 解析后的属性值
 *
 * @example
 * ```ts
 * const visible = await resolvePropertyCondition(
 *   (values) => !!values.province,
 *   { province: '广东' },
 *   false
 * )
 * // => true
 * ```
 */
export async function resolvePropertyCondition<T extends Values, R>(
  form: SchemxInstance<T>,
  condition: SchemxConditionFn<T, R>,
  formValues: T,
  defaultValue: R
): Promise<R> {
  try {
    const result = await condition(formValues, form)

    if (result == null) {
      return defaultValue
    }

    return result
  } catch (error) {
    console.error("[schemx] 解析动态属性时发生错误:", error)

    return defaultValue
  }
}
