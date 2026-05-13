/**
 * schema 列配置工具函数
 *
 * 提供列类型守卫和初始值提取功能，用于 schemx 的列配置解析。
 *
 * @module utils/schema
 */

import type {
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RuntimeNode,
  SchemxBaseField,
  SchemxDependencyField,
  SchemxField,
  SchemxGroupField,
  SchemxResolvedField,
  Values,
} from "../types"

/**
 * 类型守卫：判断是否为基础字段配置
 *
 * 排除 group、dependency、nested 三种特殊类型后，剩余的即为基础字段。
 *
 * @param schema - 列配置
 * @returns 是否为基础字段
 */
export function isBaseSchema<T extends Values = Values>(
  schema: SchemxField<T>
): schema is SchemxBaseField<T> {
  return !isGroupSchema(schema) && !isDependencySchema(schema)
}

/**
 * 类型守卫：判断是否为分组列配置
 *
 * @param schema - 列配置
 * @returns 是否为 `componentType === "group"` 的分组列
 */
export function isGroupSchema<T extends Values = Values>(
  schema: SchemxField<T>
): schema is SchemxGroupField<T> {
  return schema.componentType === "group"
}

/**
 * 类型守卫：判断是否为依赖列配置
 *
 * @param schema - 列配置
 * @returns 是否为 `componentType === "dependency"` 的依赖列
 */
export function isDependencySchema<T extends Values = Values>(
  schema: SchemxField<T>
): schema is SchemxDependencyField<T> {
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
export function findSchema<T extends Values = Values>(
  schemas: SchemxField<T>[],
  name: string
): SchemxBaseField<T> | undefined {
  for (const schema of schemas) {
    if (isBaseSchema(schema) && schema.name === name) {
      return schema
    }

    if (isGroupSchema(schema)) {
      const found = findSchema<T>(schema.children as SchemxField<T>[], name)

      if (found) return found
    }
  }

  return undefined
}

// ---------------------------------------------------------------------------
// ResolvedSchema
// ---------------------------------------------------------------------------

/**
 * 类型守卫：判断是否为 序列化后的 基础字段配置
 *
 * 排除 group、dependency、nested 三种特殊类型后，剩余的即为基础字段。
 *
 * @param schema - 列配置
 * @returns 是否为基础字段
 */
export function isBaseResolvedSchema<T extends Values = Values>(
  schema: SchemxResolvedField<T>
): schema is SchemxBaseField<T> {
  return !isGroupResolvedSchema(schema)
}

/**
 * 类型守卫：判断是否为 序列化后的 分组列配置
 *
 * @param schema - 列配置
 * @returns 是否为 `componentType === "group"` 的分组列
 */
export function isGroupResolvedSchema<T extends Values = Values>(
  schema: SchemxResolvedField<T>
): schema is SchemxGroupField<T> {
  return schema.componentType === "group"
}

// ---------------------------------------------------------------------------
// RuntimeNode
// ---------------------------------------------------------------------------

/**
 * 类型守卫：判断是否为基础字段配置
 *
 * 排除 group、dependency 两种特殊类型后，剩余的即为基础字段。
 *
 * @param node - 列配置
 * @returns 是否为基础字段
 */
export function isFieldRuntimeNode<T extends Values = Values>(
  node: RuntimeNode<T>
): node is FieldRuntimeNode<T> {
  return !isGroupRuntimeNode(node) && !isDependencyRuntimeNode(node)
}

/**
 * 类型守卫：判断是否为分组列配置
 *
 * @param node - 列配置
 * @returns 是否为 `type === "group"` 的分组列
 */
export function isGroupRuntimeNode<T extends Values = Values>(
  node: RuntimeNode<T>
): node is GroupRuntimeNode<T> {
  return node.type === "group"
}

/**
 * 类型守卫：判断是否为依赖列配置
 *
 * @param node - 列配置
 * @returns 是否为 `type === "dependency"` 的依赖列
 */
export function isDependencyRuntimeNode<T extends Values = Values>(
  node: RuntimeNode<T>
): node is DependencyRuntimeNode<T> {
  return node.type === "dependency"
}
