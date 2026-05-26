/**
 * buildViewSchemas - 渲染 schema 构建算法。
 *
 * 从 Fiber Tree 生成处理后的 SchemxField 风格 schema。
 * 核心原则：
 * - dependency Fiber 透明展开
 * - group 保留 children 结构
 * - field 保持扁平 schema 格式
 * - disposed Fiber 被跳过
 *
 * @module core/view/buildViewSchemas
 */

import { getFieldModelResource } from "../field"
import { getChildFibers, isDependencyFiber, isFieldFiber, isGroupFiber } from "../graph"

import type {
  SchemxViewDebugMeta,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
} from "./types"
import type { FieldModel } from "../field"
import type { DependencyFiber, Fiber, FieldFiber, GroupFiber, RootFiber } from "../graph"
import type { SchemxComponentProps, SchemxResolvedBaseField, Values } from "../types"

/**
 * 安全深度限制。
 */
const MAX_DEPTH = 100

/**
 * 将 FieldModel 构建为字段 ViewSchema。
 */
function buildFieldViewSchema<TValues extends Values = Values>(
  fiber: FieldFiber,
  model: FieldModel
): SchemxViewFieldSchema<TValues> | null {
  const descriptor = fiber.descriptor

  if (descriptor?.type !== "field") {
    return null
  }

  const schema = descriptor.schema as SchemxResolvedBaseField<TValues>

  return {
    ...schema,
    key: fiber.key,
    visible: model.visible.value,
    label: model.label.value,
    readonly: model.readonly.value,
    disabled: model.disabled.value,
    required: model.required.value,
    placeholder: sanitizePlaceholder(String(model.placeholder.value ?? "")),
    componentProps: sanitizeComponentProps(
      model.componentProps.value ?? {}
    ) as SchemxComponentProps<TValues>,
    rules: model.rules.value,
    validationTrigger: schema.validationTrigger,
    debug: buildDebugMeta(fiber),
  } as SchemxViewFieldSchema<TValues>
}

/**
 * 将 group Fiber 构建为分组 ViewSchema。
 */
function buildGroupViewSchema<TValues extends Values = Values>(
  fiber: GroupFiber,
  depth: number
): SchemxViewGroupSchema<TValues> {
  const children = buildFiberChildren<TValues>(getChildFibers(fiber), depth + 1)
  const descriptor = fiber.descriptor

  return {
    ...descriptor.schema,
    key: fiber.key,
    children,
    debug: buildDebugMeta(fiber),
  } as SchemxViewGroupSchema<TValues>
}

/**
 * 递归构建 Fiber 子节点。
 */
function buildFiberChildren<TValues extends Values = Values>(
  fibers: readonly Fiber[],
  depth: number
): readonly SchemxViewSchema<TValues>[] {
  if (depth > MAX_DEPTH) {
    throw new RangeError(
      `buildViewSchemas: max depth ${MAX_DEPTH} exceeded at depth ${depth}`
    )
  }

  const results: SchemxViewSchema<TValues>[] = []

  for (const fiber of fibers) {
    const schema = buildFiberSchema<TValues>(fiber, depth)

    if (schema === null) {
      continue
    }

    if (Array.isArray(schema)) {
      for (const child of schema) {
        results.push(child)
      }

      continue
    }

    results.push(schema as SchemxViewSchema<TValues>)
  }

  return results
}

/**
 * 构建单个 Fiber 对应的 ViewSchema。
 */
function buildFiberSchema<TValues extends Values = Values>(
  fiber: Fiber,
  depth: number
): SchemxViewSchema<TValues> | readonly SchemxViewSchema<TValues>[] | null {
  if (fiber.disposed.value) {
    return null
  }

  if (isGroupFiber(fiber)) {
    return buildGroupViewSchema<TValues>(fiber, depth)
  }

  if (isDependencyFiber(fiber)) {
    return buildDependencyFiber<TValues>(fiber, depth)
  }

  if (isFieldFiber(fiber)) {
    const fieldModel = getFieldModelResource(fiber)

    if (fieldModel) {
      return buildFieldViewSchema<TValues>(fiber, fieldModel)
    }

    console.warn(
      `[buildViewSchemas] skipping field fiber "${fiber.key}": no FieldModel resource`
    )

    return null
  }

  return null
}

function buildDependencyFiber<TValues extends Values = Values>(
  fiber: DependencyFiber,
  depth: number
): readonly SchemxViewSchema<TValues>[] {
  return buildFiberChildren<TValues>(getChildFibers(fiber), depth + 1)
}

/**
 * 截断 placeholder 到 1000 字符。
 */
function sanitizePlaceholder(value: string): string {
  return value.length > 1000 ? value.slice(0, 1000) : value
}

/**
 * 清理 componentProps。
 *
 * - 校验键名格式
 * - 限制嵌套深度
 * - 浅拷贝防止内部引用泄漏
 */
function sanitizeComponentProps<TValues extends Values = Values>(
  props: SchemxComponentProps<TValues>,
  depth: number = 0
): Readonly<Record<string, unknown>> {
  if (depth > 10) {
    return {}
  }

  const result: Record<string, unknown> = {}

  for (const key of Object.keys(props)) {
    if (!isValidPropKey(key)) {
      continue
    }

    const value = (props as Record<string, unknown>)[key]

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeComponentProps(value, depth + 1)
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * 校验 componentProps 键名格式。
 */
function isValidPropKey(key: string): boolean {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
    return true
  }

  if (/^[a-zA-Z0-9_-]+$/.test(key)) {
    return true
  }

  return false
}

/**
 * 构建调试元数据。
 */
function buildDebugMeta(fiber: Fiber): Readonly<SchemxViewDebugMeta> {
  return {
    fiberId: fiber.id,
    fiberType: fiber.type,
    hasFieldModel: fiber.type === "field" && fiber.fieldModel !== undefined,
    hasDependencySlot: fiber.type === "dependency" && fiber.dependencySlot !== undefined,
  }
}

/**
 * 从 Root Fiber 构建 ViewSchemas。
 *
 * root Fiber 是透明的，返回 root.childFibers 的构建结果，而非 root 自身。
 *
 * @param root - root runtime 节点；为空时返回空数组。
 * @returns 可供渲染层消费的 ViewSchemas。
 */
export function buildViewSchemas<TValues extends Values = Values>(
  root: RootFiber | null | undefined
): readonly SchemxViewSchema<TValues>[] {
  if (!root) {
    return []
  }

  return buildFiberChildren<TValues>(getChildFibers(root), 1)
}
