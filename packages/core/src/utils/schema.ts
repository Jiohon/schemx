/**
 * schema 列配置工具函数
 *
 * 提供列类型守卫和初始值提取功能，用于 schemx 的列配置解析。
 *
 * @module utils/schema
 */

import type {
  SchemxBaseField,
  SchemxDependencyField,
  SchemxField,
  SchemxGroupField,
  SchemxResolvedBaseField,
  SchemxResolvedField,
  SchemxResolvedGroupField,
  Values,
} from "../types"

/** Schema 的结构分类结果。 */
export type SchemaKind =
  | "field"
  | "group"
  | "dependency"
  | "legacy-group"
  | "legacy-dependency"
  | "ambiguous"
  | "unknown"

/**
 * 根据 Raw Schema 的顶层结构识别类型。
 *
 * 该函数只分类，不校验各类型的完整必填项。旧容器语法和多结构歧义会返回
 * 独立结果，由编译边界生成可操作的错误信息。
 *
 * @param schema - 待识别的未知 Schema。
 * @returns Schema 的结构分类结果。
 */
export function getSchemaKind(schema: unknown): SchemaKind {
  if (!isSchemaRecord(schema)) {
    return "unknown"
  }

  const hasFieldMarker =
    Object.hasOwn(schema, "name") || Object.hasOwn(schema, "componentType")
  const hasGroupMarker = Object.hasOwn(schema, "children")
  const hasDependencyMarker =
    Object.hasOwn(schema, "to") || Object.hasOwn(schema, "renderer")
  const componentType = schema.componentType

  if (componentType === "group" && hasGroupMarker && !hasDependencyMarker) {
    return "legacy-group"
  }

  if (componentType === "dependency" && hasDependencyMarker && !hasGroupMarker) {
    return "legacy-dependency"
  }

  const markerCount = [hasFieldMarker, hasGroupMarker, hasDependencyMarker].filter(
    Boolean
  ).length

  if (markerCount > 1) {
    return "ambiguous"
  }

  if (hasGroupMarker) {
    return "group"
  }

  if (hasDependencyMarker) {
    return "dependency"
  }

  if (hasFieldMarker) {
    return "field"
  }

  return "unknown"
}

/**
 * 类型守卫：判断是否为基础字段配置
 *
 * 普通字段具有 `name` 或 `componentType`，且不包含容器结构字段。
 *
 * @param schema - 列配置
 * @returns 是否为基础字段
 *
 * @example
 * ```ts
 * const schemas = [
 *   { name: 'username', label: '用户名', componentType: 'input' },
 *   { label: '资料', children: [...] },
 *   { to: ['type'], renderer: () => [...] }
 * ]
 *
 * schemas.forEach(schema => {
 *   if (isBaseSchema(schema)) {
 *     // TypeScript 现在知道这是 SchemxBaseField
 *     console.log('基础字段:', schema.name)
 *   }
 * })
 * ```
 */
export function isBaseSchema<T extends Values = Values>(
  schema: SchemxField<T>
): schema is SchemxBaseField<T> {
  return getSchemaKind(schema) === "field"
}

/**
 * 类型守卫：判断是否为分组列配置
 *
 * @param schema - 列配置
 * @returns 是否为包含 `children` 的分组 Schema
 *
 * @example
 * ```ts
 * const schema = {
 *   label: '资料',
 *   children: [
 *     { name: 'name', label: '姓名', componentType: 'input' },
 *     { name: 'age', label: '年龄', componentType: 'number' }
 *   ]
 * }
 *
 * if (isGroupSchema(schema)) {
 *   // TypeScript 现在知道这是 SchemxGroupField
 *   schema.children.forEach(child => {
 *     console.log('子字段:', child)
 *   })
 * }
 * ```
 */
export function isGroupSchema<T extends Values = Values>(
  schema: SchemxField<T>
): schema is SchemxGroupField<T> {
  return getSchemaKind(schema) === "group"
}

/**
 * 类型守卫：判断是否为依赖列配置
 *
 * @param schema - 列配置
 * @returns 是否为包含 `to` 和 `renderer` 结构标记的 Dependency Schema
 *
 * @example
 * ```ts
 * const schema = {
 *   to: ['type'],
 *   renderer: (values) => {
 *     if (values.type === 'A') {
 *       return [{ name: 'fieldA', componentType: 'input' }]
 *     }
 *     return [{ name: 'fieldB', componentType: 'input' }]
 *   }
 * }
 *
 * if (isDependencySchema(schema)) {
 *   // TypeScript 现在知道这是 SchemxDependencyField
 *   const dynamicSchemas = schema.renderer({ type: 'A' }, form, context)
 * }
 * ```
 */
export function isDependencySchema<T extends Values = Values>(
  schema: SchemxField<T>
): schema is SchemxDependencyField<T> {
  return getSchemaKind(schema) === "dependency"
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
 * ```ts
 * const schemas = [
 *   { name: 'username', label: '用户名', componentType: 'input' },
 *   {
 *     label: '资料',
 *     children: [
 *       { name: 'email', label: '邮箱', componentType: 'input' }
 *     ]
 *   }
 * ]
 *
 * // 在顶层找到
 * const usernameSchema = findSchema(schemas, 'username')
 * console.log(usernameSchema?.label) // => '用户名'
 *
 * // 在 group 中递归找到
 * const emailSchema = findSchema(schemas, 'email')
 * console.log(emailSchema?.label) // => '邮箱'
 *
 * // 未找到
 * const notFound = findSchema(schemas, 'nonexistent')
 * console.log(notFound) // => undefined
 * ```
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

/**
 * 类型守卫：判断是否为 序列化后的 基础字段配置
 *
 * Resolved Schema 不包含 Dependency，排除 Group 后即为普通字段。
 *
 * @param schema - 列配置
 * @returns 是否为基础字段
 *
 * @example
 * ```ts
 * // 在处理 getViewSchemas 返回的解析后 schemas 时使用
 * const viewSchemas = form.getViewSchemas()
 *
 * viewSchemas.forEach(schema => {
 *   if (isBaseResolvedSchema(schema)) {
 *     console.log('基础字段:', schema.name)
 *   }
 * })
 * ```
 */
export function isBaseResolvedSchema<T extends Values = Values>(
  schema: SchemxResolvedField<T>
): schema is SchemxResolvedBaseField<T> {
  return !isGroupResolvedSchema(schema)
}

/**
 * 类型守卫：判断是否为 序列化后的 分组列配置
 *
 * @param schema - 列配置
 * @returns 是否为包含 `children` 的分组列
 *
 * @example
 * ```ts
 * const viewSchemas = form.getViewSchemas()
 *
 * viewSchemas.forEach(schema => {
 *   if (isGroupResolvedSchema(schema)) {
 *     // 递归处理子字段
 *     schema.children.forEach(child => {
 *       console.log('子字段:', child)
 *     })
 *   }
 * })
 * ```
 */
export function isGroupResolvedSchema<T extends Values = Values>(
  schema: SchemxResolvedField<T>
): schema is SchemxResolvedGroupField<T> {
  return "children" in schema
}

function isSchemaRecord(schema: unknown): schema is Record<string, unknown> {
  return typeof schema === "object" && schema !== null
}
