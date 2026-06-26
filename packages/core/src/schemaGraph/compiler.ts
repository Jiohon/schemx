/**
 * T028 [US1] - Schema Compiler
 *
 * 只读 schema normalize，输出 field/group/dynamic-slot SchemaNode。
 * 对非法 schema 产出 fail-fast diagnostics。
 *
 * @module core/schemaGraph/compiler
 */

import type {
  NormalizedSchemaNode,
  NormalizedFieldNode,
  NormalizedGroupNode,
  NormalizedDynamicSlotNode,
  SchemaCompileResult,
} from "./types"
import type {
  SchemxField,
  SchemxBase,
  SchemxGroupField,
  SchemxDependencyField,
  SchemxResolvedBaseField,
  SchemxResolvedGroupField,
} from "../types/schema"
import type { Values } from "../types/form"
import type { SchemaInputError } from "../runtimeGraph/types"

/**
 * 编译 schema 输入，生成规范化节点和诊断信息。
 */
export function compileSchema<TValues extends Values = Values>(
  schemas: readonly SchemxField<TValues>[]
): SchemaCompileResult<TValues> {
  const normalizedNodes: NormalizedSchemaNode<TValues>[] = []
  const errors: SchemaInputError[] = []

  if (!schemas || schemas.length === 0) {
    return { normalizedNodes: [], errors: [] }
  }

  // 深拷贝输入以确保不会修改原始对象
  const schemasCopy = JSON.parse(JSON.stringify(schemas)) as SchemxField<TValues>[]

  for (let i = 0; i < schemasCopy.length; i++) {
    const schema = schemasCopy[i]
    const normalized = normalizeSchema(schema, errors, [`${i}`])
    if (normalized) {
      normalizedNodes.push(normalized)
    }
  }

  return {
    normalizedNodes,
    errors,
  }
}

/**
 * 判断 schema 是否为分组字段。
 */
function isGroupField<TValues extends Values>(
  schema: SchemxField<TValues>
): schema is SchemxGroupField<TValues> {
  return (
    "children" in schema ||
    (schema as { componentType?: string }).componentType === "group"
  )
}

/**
 * 判断 schema 是否为依赖字段（动态插槽）。
 */
function isDependencyField<TValues extends Values>(
  schema: SchemxField<TValues>
): schema is SchemxDependencyField<TValues> {
  return (
    (schema as { componentType?: string }).componentType === "dependency"
  )
}

/**
 * 规范化单个 schema 节点。
 */
function normalizeSchema<TValues extends Values>(
  schema: SchemxField<TValues>,
  errors: SchemaInputError[],
  path: string[]
): NormalizedSchemaNode<TValues> | null {
  if (!schema) {
    errors.push({
      type: "invalid_schema",
      path,
      message: `Schema at ${path.join(".")} is null or undefined`,
    })
    return null
  }

  if (isGroupField(schema)) {
    return normalizeGroup(schema, errors, path)
  }

  if (isDependencyField(schema)) {
    return normalizeDynamicSlot(schema, errors)
  }

  // 其余作为字段处理
  return normalizeField(schema, errors)
}

/**
 * 提取字段的通用属性（兼容 SchemxBaseField 分布式条件类型）。
 */
function extractFieldProps<TValues extends Values>(
  schema: SchemxField<TValues>
): Pick<
  SchemxBase<TValues, string>,
  "key" | "name" | "componentType" | "componentProps" | "dependencies"
> & { staticSchema: object } {
  const s = schema as SchemxBase<TValues, string> & {
    dependencies?: unknown
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { dependencies, ...staticSchema } = s
  return {
    key: s.key,
    name: s.name,
    componentType: s.componentType,
    componentProps: s.componentProps,
    dependencies: s.dependencies,
    staticSchema,
  }
}

/**
 * 规范化字段。
 */
function normalizeField<TValues extends Values>(
  schema: SchemxField<TValues>,
  errors: SchemaInputError[]
): NormalizedFieldNode<TValues> | null {
  const props = extractFieldProps(schema)

  if (!props.name) {
    errors.push({
      type: "invalid_node",
      message: "Field is missing name",
    })
    return null
  }

  return {
    kind: "field",
    key: props.key,
    name: props.name,
    staticSchema: props.staticSchema as SchemxResolvedBaseField<TValues>,
    dependencies: props.dependencies as NormalizedFieldNode<TValues>["dependencies"],
  }
}

/**
 * 规范化分组。
 */
function normalizeGroup<TValues extends Values>(
  schema: SchemxGroupField<TValues>,
  errors: SchemaInputError[],
  path: string[]
): NormalizedGroupNode<TValues> | null {
  const children: NormalizedSchemaNode<TValues>[] = []

  if (schema.children && Array.isArray(schema.children)) {
    for (let i = 0; i < schema.children.length; i++) {
      const child = schema.children[i]
      const childPath = [...path, `${i}`]
      const normalized = normalizeSchema(child, errors, childPath)
      if (normalized) {
        children.push(normalized)
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { children: _children, ...staticSchema } = schema

  return {
    kind: "group",
    key: schema.key,
    staticSchema: {
      ...staticSchema,
      componentType: "group",
    } as SchemxResolvedGroupField<TValues>,
    children,
  }
}

/**
 * 规范化动态插槽。
 */
function normalizeDynamicSlot<TValues extends Values>(
  schema: SchemxDependencyField<TValues>,
  errors: SchemaInputError[]
): NormalizedDynamicSlotNode<TValues> | null {
  return {
    kind: "dynamic_slot",
    key: schema.key,
    to: (schema as SchemxDependencyField<TValues> & { to?: string[] }).to || [],
    renderer:
      (schema as SchemxDependencyField<TValues> & { renderer?: NormalizedDynamicSlotNode<TValues>["renderer"] }).renderer,
  } as NormalizedDynamicSlotNode<TValues>
}

/**
 * 验证 schema 输入是否有效，返回错误列表。
 */
export function validateSchemaInput<TValues extends Values>(
  schemas: readonly SchemxField<TValues>[]
): SchemaInputError[] {
  const result = compileSchema(schemas)
  return result.errors as SchemaInputError[]
}
