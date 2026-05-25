/**
 * Schema 类型创建工具。
 *
 * 该模块提供零运行时转换的 schema factory，用于在保留字面量类型的同时，
 * 让 dependency renderer 根据 `to` 精确推断 `values`。
 *
 * @module core/defineSchemas
 */

import type { NamePath, Values } from "./types/form"
import type {
  SchemxBaseField,
  SchemxDependencyField,
  SchemxField,
  SchemxGroupField,
} from "./types/schema"

type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

/**
 * `defineSchemas` 返回的 schema 创建 API。
 *
 * @typeParam TValues - 表单值类型
 */
export interface DefineSchemasApi<TValues extends Values = Values> {
  /**
   * 创建 schema 数组，保留数组项的字面量类型，并保证每一项满足 SchemxField。
   */
  <const TSchemas extends readonly SchemxField<TValues>[]>(
    schemas: TSchemas
  ): Mutable<TSchemas> & SchemxField<TValues>[]

  /**
   * 创建基础字段 schema。
   *
   * 当渲染器通过声明合并注册后，`componentType` 会自动约束 `componentProps`。
   */
  field<const TSchema extends SchemxBaseField<TValues>>(schema: TSchema): TSchema

  /**
   * 创建分组字段 schema。
   *
   * `children` 可继续使用当前 API 创建，便于在嵌套结构中保留完整类型。
   */
  group<const TChildren extends readonly SchemxField<TValues>[]>(
    schema: Omit<SchemxGroupField<TValues>, "children"> & {
      children: TChildren
    }
  ): Omit<SchemxGroupField<TValues>, "children"> & {
    children: Mutable<TChildren> & SchemxField<TValues>[]
  }

  /**
   * 创建 dependency schema。
   *
   * `renderer(values)` 会根据 `to` 的字面量值推断为只包含依赖字段的对象类型。
   */
  dependency<const TNames extends readonly NamePath<TValues>[]>(
    schema: SchemxDependencyField<TValues, TNames>
  ): SchemxDependencyField<TValues, TNames>
}

/**
 * 创建 schema factory。
 *
 * @example
 * ```ts
 * const schema = defineSchemas<FormValues>()
 *
 * const schemas = schema([
 *   schema.field({
 *     name: "mode",
 *     label: "模式",
 *     componentType: "input",
 *   }),
 *   schema.dependency({
 *     componentType: "dependency",
 *     to: ["mode"],
 *     renderer(values) {
 *       values.mode
 *       return []
 *     },
 *   }),
 * ])
 * ```
 */
export function defineSchemas<
  TValues extends Values = Values,
>(): DefineSchemasApi<TValues> {
  const api = ((schemas: SchemxField<TValues>[]) => schemas) as DefineSchemasApi<TValues>

  api.field = ((schema: SchemxBaseField<TValues>) =>
    schema) as DefineSchemasApi<TValues>["field"]
  api.group = ((schema: SchemxGroupField<TValues>) =>
    schema) as DefineSchemasApi<TValues>["group"]
  api.dependency = ((schema: SchemxDependencyField<TValues>) =>
    schema) as DefineSchemasApi<TValues>["dependency"]

  return api
}
