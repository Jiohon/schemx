/**
 * Schema 标准化工具
 *
 * 标准化 schema 配置，移除必填项未填的配置，并在控制台输出警告信息。
 *
 * @module utils/normalize
 */

import { CompileError } from "../compiler/types"

import { getSchemaKind } from "./schema"

import type {
  SchemxBaseField,
  SchemxDependencyField,
  SchemxField,
  SchemxGroupField,
  Values,
} from "../types"

/**
 * 检查 name 是否合法
 *
 * 要求同时满足：存在 name 属性，且 name 不为 null、undefined 或空字符串。
 *
 * @param schema - 基础字段配置
 * @returns name 合法时返回 true
 */
const isLegalName = <T extends Values>(schema: SchemxBaseField<T>) =>
  Object.hasOwn(schema, "name") && [null, undefined, ""].every((i) => i !== schema.name)

/**
 * 检查 componentType 是否合法
 *
 * 要求同时满足：存在 componentType 属性，且类型为字符串。
 *
 * @param schema - 字段配置
 * @returns componentType 合法时返回 true
 */
const isLegalComponentType = <T extends Values>(schema: SchemxBaseField<T>) =>
  Object.hasOwn(schema, "componentType") && typeof schema.componentType === "string"

/**
 * 校验基础字段的必填项是否完整
 *
 * 基础字段必须包含 name、label、componentType 三个字段。
 *
 * @param schema - 基础字段配置
 * @returns 缺失的字段名数组，为空表示校验通过
 */
function getBaseFieldMissing<T extends Values>(schema: SchemxBaseField<T>): string[] {
  const missing: string[] = []

  if (!isLegalName(schema)) missing.push("name")

  if (!isLegalComponentType(schema)) missing.push("componentType")

  return missing
}

/**
 * 校验分组字段的必填项是否完整
 *
 * 分组字段必须包含 children 字段。
 *
 * @param schema - 分组字段配置
 * @returns 缺失的字段名数组，为空表示校验通过
 */
function getGroupFieldMissing<T extends Values>(schema: SchemxGroupField<T>): string[] {
  const missing: string[] = []

  if (!Object.hasOwn(schema, "children") || !Array.isArray(schema.children))
    missing.push("children")

  return missing
}

/**
 * 校验依赖字段的必填项是否完整
 *
 * 依赖字段必须包含 to、renderer 两个字段。
 *
 * @param schema - 依赖字段配置
 * @returns 缺失的字段名数组，为空表示校验通过
 */
function getDependencyFieldMissing<T extends Values>(
  schema: SchemxDependencyField<T>
): string[] {
  const missing: string[] = []

  if (!Object.hasOwn(schema, "to") || !Array.isArray(schema.to) || schema.to.length === 0)
    missing.push("to")

  if (typeof schema.renderer !== "function") missing.push("renderer")

  return missing
}

/**
 * 构建警告信息
 *
 * @param index - schema 在数组中的索引
 * @param schema - 字段配置
 * @param missing - 缺失的字段名数组
 * @returns 格式化的警告信息
 */
function buildWarnMessage<T extends Values>(
  index: number,
  schema: SchemxField<T>,
  missing: string[]
): string {
  const identifier =
    ("name" in schema && schema.name) ||
    ("componentType" in schema && schema.componentType) ||
    ("key" in schema && schema.key) ||
    "unknown"

  return (
    `[schemx] schemas[${index}] (${String(identifier)}) ` +
    `缺少必填项: ${missing.join(", ")}，已被过滤`
  )
}

/**
 * 过滤 schemas 数组，移除必填项未填的配置
 *
 * 对基础字段、分组字段、依赖字段分别校验其必填项，
 * 不合格的条目会被过滤掉并在控制台输出 warn 信息。
 * 分组字段的 children 会递归过滤。
 *
 * @typeParam T - 表单值类型
 * @param schemas - 原始 schema 配置数组
 * @returns 过滤后的 schema 配置数组
 *
 * @example
 * ```ts
 * const cleaned = normalizeSchemas([
 *   { name: '', label: '用户名', componentType: 'input' },  // name 为空，被过滤
 *   { name: 'email', label: '邮件', componentType: '' },  // componentType 为空，被过滤
 *   { label: '分组', children: [] },
 * ])
 * ```
 */
export function normalizeSchemas<T extends Values = Values>(
  schemas: SchemxField<T>[]
): SchemxField<T>[] {
  const result: SchemxField<T>[] = []
  const missings: string[] = []
  let changed = false

  for (let i = 0; i < schemas.length; i++) {
    const schema = schemas[i]
    let missing: string[] = []

    const kind = getSchemaKind(schema)

    assertSupportedSchemaKind(kind, schema)

    if (kind === "group") {
      const groupSchema = schema as SchemxGroupField<T>
      missing = getGroupFieldMissing(groupSchema)

      if (missing.length > 0) {
        missings.push(buildWarnMessage(i, schema, missing))
        changed = true
        continue
      }

      // 递归过滤 children；children 引用不变时保留原 group 引用，
      // 让下游引用缓存能在 schemas 未变时命中。
      const normalizedChildren = normalizeSchemas<T>(
        groupSchema.children as SchemxField<T>[]
      )

      if (normalizedChildren === groupSchema.children) {
        result.push(groupSchema)
      } else {
        result.push({ ...groupSchema, children: normalizedChildren })
        changed = true
      }
    } else if (kind === "dependency") {
      const dependencySchema = schema as SchemxDependencyField<T>
      missing = getDependencyFieldMissing(dependencySchema)

      if (missing.length > 0) {
        missings.push(buildWarnMessage(i, schema, missing))
        changed = true
        continue
      }

      result.push(dependencySchema)
    } else if (kind === "field") {
      const fieldSchema = schema as SchemxBaseField<T>
      missing = getBaseFieldMissing(fieldSchema)

      if (missing.length > 0) {
        missings.push(buildWarnMessage(i, schema, missing))
        changed = true
        continue
      }

      result.push(fieldSchema)
    } else {
      // 未知 schema 类型，跳过
      changed = true
    }
  }

  if (missings.length) console.warn(missings.join("\n"))

  // 无任何元素被过滤或重建时返回原数组引用，保证引用稳定。
  return changed ? result : schemas
}

function assertSupportedSchemaKind<T extends Values>(
  kind: ReturnType<typeof getSchemaKind>,
  schema: SchemxField<T>
): void {
  if (kind === "legacy-group") {
    throw new CompileError(
      '[schemx] Group Schema 不再接受 componentType: "group"；请删除 componentType，并通过 children 声明 Group。',
      schema
    )
  }

  if (kind === "legacy-dependency") {
    throw new CompileError(
      '[schemx] Dependency Schema 不再接受 componentType: "dependency"；请删除 componentType，并通过 to 与 renderer 声明 Dependency。',
      schema
    )
  }

  if (kind === "ambiguous") {
    throw new CompileError(
      "[schemx] Schema 同时匹配普通字段、Group 或 Dependency 的多种结构；children、to、renderer 是容器结构保留字段。",
      schema
    )
  }
}
