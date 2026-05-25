/**
 * projectViewTree - 投影算法核心。
 *
 * 从 Fiber Tree 生成 ViewNode 树。
 * 核心原则：
 * - DependencyEffectSlot 透明展开（优先级最高）
 * - Group/Fragment 类型投影
 * - FieldModel 投影为 field 类型
 * - disposed Fiber 被跳过
 *
 * @module core/view/projectViewTree
 */

import { getFieldModelResource } from "../field"
import { getChildFibers, isDependencyFiber, isFieldFiber, isGroupFiber } from "../graph"

import type {
  ContainerViewNode,
  FieldViewNode,
  FieldViewProps,
  FieldViewState,
  ViewNode,
} from "./types"
import type { FieldDescriptor } from "../descriptor"
import type { FieldModel } from "../field"
import type { DependencyFiber, Fiber, FieldFiber, GroupFiber, RootFiber } from "../graph"
import type { SchemxFormApi, SchemxResolvedBaseField, Values } from "../types"

type AnyFormApi = {
  getValue(name: unknown): unknown
  isTouched(name: unknown): boolean
  isPending(name: unknown): boolean
  getError(name: unknown): string[] | undefined
}
type AnyFieldDescriptor = FieldDescriptor<any>

/**
 * 安全深度限制。
 */
const MAX_DEPTH = 100

/**
 * 将 FieldModel 投影为 FieldViewNode。
 *
 * @param fiber - Fiber 实例
 * @param model - FieldModel 实例
 * @returns FieldViewNode
 */
function projectFieldViewNode(
  fiber: FieldFiber,
  model: FieldModel,
  formApi?: AnyFormApi
): FieldViewNode | null {
  const descriptor = fiber.descriptor

  if (descriptor?.kind !== "field") {
    return null
  }

  return {
    id: fiber.id,
    key: fiber.key,
    type: "field",
    renderer: String(descriptor.schema.componentType),
    name: descriptor.schema.name,
    schema: getFieldSchema(descriptor),
    props: buildFieldViewProps(descriptor, model),
    state: buildFieldViewState(descriptor, formApi),
    children: [],
    debug: buildDebugMeta(fiber),
  } as FieldViewNode
}

/**
 * 将 Fiber 投影为 ContainerViewNode（group 或 fragment）。
 *
 * @param fiber - Fiber 实例
 * @param depth - 当前深度
 * @returns ContainerViewNode
 */
function projectContainerViewNode(
  fiber: GroupFiber,
  depth: number,
  formApi?: AnyFormApi
): ContainerViewNode {
  const children = projectFiberChildren(getChildFibers(fiber), depth + 1, formApi)
  const descriptor = fiber.descriptor

  return {
    id: fiber.id,
    key: fiber.key,
    type: "group",
    props: {
      ...EMPTY_PROPS,
      label: descriptor.schema.label ?? "",
      class: (descriptor.schema as unknown as Record<string, unknown>).class,
      componentProps: {
        collapsible: descriptor.schema.collapsible,
        defaultCollapsed: descriptor.schema.defaultCollapsed,
      },
    },
    children,
    debug: buildDebugMeta(fiber),
  } as ContainerViewNode
}

/**
 * 递归投影 Fiber 子节点。
 *
 * @param fibers - 子 Fiber 列表
 * @param depth - 当前深度
 * @returns ViewNode 列表
 */
function projectFiberChildren(
  fibers: readonly Fiber[],
  depth: number,
  formApi?: AnyFormApi
): readonly ViewNode[] {
  if (depth > MAX_DEPTH) {
    throw new RangeError(
      `projectViewTree: max depth ${MAX_DEPTH} exceeded at depth ${depth}`
    )
  }

  const results: ViewNode[] = []

  for (const fiber of fibers) {
    const node = projectFiber(fiber, depth, formApi)

    if (node !== null) {
      if (Array.isArray(node)) {
        for (const child of node) {
          results.push(child)
        }
      } else {
        results.push(node as ViewNode)
      }
    }
  }

  return results
}

/**
 * 投影单个 Fiber。
 *
 * 优先级：
 * 1. 已 disposed → null（跳过）
 * 2. DependencyEffectSlot → 透明展开 subtree
 * 3. Fiber.kind === "group" → container 投影（优先级高于 FieldModel）
 * 4. FieldModel → field 投影
 * 5. kind="field" 但无 FieldModel → 跳过并记录警告
 * 6. 其他 → container 投影（fragment）
 *
 * @param fiber - Fiber 实例
 * @param depth - 当前深度
 * @returns ViewNode、ViewNode 数组或 null
 */
function projectFiber(
  fiber: Fiber,
  depth: number,
  formApi?: AnyFormApi
): ViewNode | readonly ViewNode[] | null {
  // 跳过已销毁的 Fiber
  if (fiber.disposed.value) {
    return null
  }

  if (isGroupFiber(fiber)) {
    return projectContainerViewNode(fiber, depth, formApi)
  }

  if (isDependencyFiber(fiber)) {
    return projectDependencyFiber(fiber, depth, formApi)
  }

  if (isFieldFiber(fiber)) {
    const fieldModel = getFieldModelResource(fiber)

    if (fieldModel) {
      return projectFieldViewNode(fiber, fieldModel, formApi)
    }

    console.warn(
      `[projectViewTree] skipping field fiber "${fiber.key}": no FieldModel resource`
    )

    return null
  }

  return null
}

function projectDependencyFiber(
  fiber: DependencyFiber,
  depth: number,
  formApi?: AnyFormApi
): readonly ViewNode[] {
  return projectFiberChildren(getChildFibers(fiber), depth + 1, formApi)
}

/**
 * 空 FieldViewProps 常量。
 */
const EMPTY_PROPS: Readonly<FieldViewProps> = {
  label: "",
  visible: true,
  readonly: false,
  disabled: false,
  required: false,
  placeholder: "",
  componentProps: {},
}

/**
 * 空 FieldViewState 常量。
 */
const EMPTY_STATE: Readonly<FieldViewState> = {
  value: undefined,
  touched: false,
  pending: false,
  errors: [],
  validating: false,
}

/**
 * 从 FieldModel 构建 FieldViewProps 快照。
 *
 * @param model - FieldModel 实例
 * @returns FieldViewProps 只读快照
 */
function buildFieldViewProps(
  descriptor: AnyFieldDescriptor,
  model: FieldModel
): Readonly<FieldViewProps> {
  try {
    const schema = descriptor.schema

    const placeholder = sanitizePlaceholder(String(model.placeholder.value ?? ""))
    const componentProps = sanitizeComponentProps(
      (model.componentProps.value ?? {}) as Record<string, unknown>
    )

    return {
      componentType: schema.componentType,
      label: schema.label ?? "",
      visible: model.visible.value,
      readonly: model.readonly.value,
      disabled: model.disabled.value,
      required: model.required.value,
      placeholder,
      componentProps,
      rules: model.rules.value,
      validationTrigger: descriptor.validation.trigger,
      labelIcon: schema.labelIcon,
      labelAlign: schema.labelAlign,
      labelPosition: schema.labelPosition,
      labelWidth: schema.labelWidth,
      contentAlign: schema.contentAlign,
      colon: schema.colon,
      class: (schema as unknown as Record<string, unknown>).class,
      style: (schema as unknown as Record<string, unknown>).style,
    }
  } catch {
    return EMPTY_PROPS
  }
}

/**
 * 从 FieldModel 构建 FieldViewState 快照。
 *
 * @param model - FieldModel 实例
 * @returns FieldViewState 只读快照
 */
function buildFieldViewState(
  descriptor: AnyFieldDescriptor,
  formApi?: AnyFormApi
): Readonly<FieldViewState> {
  try {
    if (!formApi) {
      return EMPTY_STATE
    }

    const name = descriptor.schema.name
    const errors = sanitizeErrors(formApi.getError(name) ?? [])

    return {
      value: formApi.getValue(name),
      touched: formApi.isTouched(name),
      pending: formApi.isPending(name),
      errors,
      validating: formApi.isPending(name),
    }
  } catch {
    return EMPTY_STATE
  }
}

/**
 * 截断 placeholder 到 1000 字符。
 *
 * @param value - 原始 placeholder
 * @returns 截断后的 placeholder
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
 *
 * @param props - 原始 componentProps
 * @param depth - 当前深度
 * @returns 清理后的 componentProps
 */
function sanitizeComponentProps(
  props: Record<string, unknown>,
  depth: number = 0
): Readonly<Record<string, unknown>> {
  if (depth > 10) {
    return {}
  }

  const result: Record<string, unknown> = {}

  for (const key of Object.keys(props)) {
    // 键名格式校验：有效的 JS 标识符或由字母、数字、下划线、连字符组成
    if (!isValidPropKey(key)) {
      continue
    }

    const value = props[key]

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeComponentProps(value as Record<string, unknown>, depth + 1)
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * 校验 componentProps 键名格式。
 *
 * @param key - 键名
 * @returns 是否有效
 */
function isValidPropKey(key: string): boolean {
  // 有效的 JS 标识符
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
    return true
  }

  // 允许字母、数字、下划线、连字符
  if (/^[a-zA-Z0-9_-]+$/.test(key)) {
    return true
  }

  return false
}

/**
 * 截断 errors 数组到 100 项。
 *
 * @param errors - 原始错误数组
 * @returns 截断后的错误数组
 */
function sanitizeErrors(errors: readonly string[]): readonly string[] {
  const sanitized = errors.length > 100 ? errors.slice(0, 100) : errors

  return [...sanitized]
}

/**
 * 构建调试元数据（仅开发模式）。
 *
 * @param fiber - Fiber 实例
 * @returns 调试元数据或 undefined
 */
function buildDebugMeta(fiber: Fiber):
  | Readonly<{
      readonly fiberKind: string
      readonly hasFieldModel: boolean
      readonly hasDependencySlot: boolean
    }>
  | undefined {
  // 总是提供调试元数据（可在生产环境移除此逻辑）
  return {
    fiberKind: fiber.kind,
    hasFieldModel: fiber.kind === "field" && fiber.fieldModel !== undefined,
    hasDependencySlot: fiber.kind === "dependency" && fiber.dependencySlot !== undefined,
  }
}

function getFieldSchema(
  descriptor: AnyFieldDescriptor | undefined
): Readonly<SchemxResolvedBaseField> {
  return descriptor?.schema ?? ({} as SchemxResolvedBaseField)
}

/**
 * 从 Root Fiber 投影 ViewTree。
 *
 * root Fiber 是透明的——返回的是 root.childFibers 的投影结果，而非 root 自身。
 * 这确保 Adapter 获得的 ViewTree 从直接子节点开始。
 *
 * @param root - root Fiber，或 null/undefined
 * @returns 只读 ViewNode 数组
 *
 * @throws RangeError - 嵌套深度超过 100 层时
 *
 * @example
 * ```ts
 * const rootFiber = fiberManager.createRoot()
 * // ... 通过 Reconciler 添加子节点 ...
 *
 * const viewTree = projectViewTree(rootFiber)
 * // viewTree 是 root.childFibers 的投影结果
 * ```
 */
export function projectViewTree<TValues extends Values = Values>(
  root: RootFiber | null | undefined,
  formApi?: SchemxFormApi<TValues>
): readonly ViewNode[] {
  if (!root) {
    return []
  }

  // root Fiber 透明展开：只投影 root.childFibers
  return projectFiberChildren(getChildFibers(root), 1, formApi)
}
