/**
 * Schema 类型创建工具。
 *
 * 该模块提供零运行时转换的 schema 定义函数，用于在保留数组字面量类型的同时，
 * 校验每一项满足 SchemxField。
 *
 * @module core/defineSchemas
 */

import type { Values } from "./types/form"
import type { SchemxField } from "./types/schema"

type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

type MutableSchemas<TValues extends Values, TSchemas extends readonly SchemxField<TValues>[]> =
  Mutable<TSchemas> & SchemxField<TValues>[]

/**
 * `defineSchemas` 的函数签名。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface DefineSchemasApi<TValues extends Values = Values> {
  /**
   * 创建 schema 数组。
   *
   * @param schemas - 表单 schema 数组。
   * @returns 原始 schema 数组，不做运行时转换。
   */
  <const TSchemas extends readonly SchemxField<TValues>[]>(
    schemas: TSchemas
  ): MutableSchemas<TValues, TSchemas>
}

/**
 * 创建 schema 数组，保留字面量类型。
 *
 * @param schemas - 表单 schema 数组。
 * @returns 原始 schema 数组，不做运行时转换。
 *
 * @example
 * ```ts
 * const schemas = defineSchemas<FormValues>([
 *   {
 *     name: "mode",
 *     label: "模式",
 *     componentType: "input",
 *   },
 *   {
 *     componentType: "dependency",
 *     to: ["mode"],
 *     renderer(values) {
 *       values.mode
 *       return []
 *     },
 *   },
 * ])
 * ```
 */
export function defineSchemas<
  TValues extends Values = Values,
  const TSchemas extends readonly SchemxField<TValues>[] = readonly SchemxField<TValues>[],
>(schemas: TSchemas): MutableSchemas<TValues, TSchemas> {
  return schemas as MutableSchemas<TValues, TSchemas>
}
