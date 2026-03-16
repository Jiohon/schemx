/**
 * schema 列配置工具函数
 *
 * 提供列类型守卫和初始值提取功能，用于 schemx 的列配置解析。
 *
 * @module utils/schema
 */

import type {
  FormValues,
  SchemaBaseField,
  SchemaDependencyField,
  SchemaField,
  SchemaGroupField,
} from "../types"

/**
 * 类型守卫：判断是否为基础字段配置
 *
 * 排除 group、dependency、nested 三种特殊类型后，剩余的即为基础字段。
 *
 * @param schema - 列配置
 * @returns 是否为基础字段
 */
export function isBaseSchema<T extends FormValues = FormValues>(
  schema: SchemaField<T>
): schema is SchemaBaseField<T> {
  return !isGroupSchema(schema) && !isDependencySchema(schema)
}

/**
 * 类型守卫：判断是否为分组列配置
 *
 * @param schema - 列配置
 * @returns 是否为 `componentType === "group"` 的分组列
 */
export function isGroupSchema<T extends FormValues = FormValues>(
  schema: SchemaField<T>
): schema is SchemaGroupField<T> {
  return schema.componentType === "group"
}

/**
 * 类型守卫：判断是否为依赖列配置
 *
 * @param schema - 列配置
 * @returns 是否为 `componentType === "dependency"` 的依赖列
 */
export function isDependencySchema<T extends FormValues = FormValues>(
  schema: SchemaField<T>
): schema is SchemaDependencyField<T> {
  return schema.componentType === "dependency"
}

/**
 * 在列配置树中按字段名查找基础字段配置。
 *
 * 递归搜索 group、nested 的子 schemas，返回第一个匹配的基础字段。
 *
 * @param schemas - 列配置数组
 * @param name - 字段名称
 *
 * @returns 匹配的基础字段配置，未找到时返回 undefined
 *
 * @example
 * const schema = findSchema(schemas, 'email')
 */
export function findSchema<T extends FormValues = FormValues>(
  schemas: SchemaField<T>[],
  name: string
): SchemaBaseField<T> | undefined {
  for (const schema of schemas) {
    if (isBaseSchema(schema) && String(schema.name) === name) {
      return schema
    }

    if (isGroupSchema(schema)) {
      const found = findSchema<T>(schema.children as SchemaField<T>[], name)

      if (found) return found
    }
  }

  return undefined
}
