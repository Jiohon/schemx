/**
 * ViewGraph - 节点级 ViewSchema computed 图。
 *
 * 为 field、group、dependency 和 root 创建 computed view，让未变化子树
 * 的 ViewSchema 引用可以复用，并把 sanitize 成本限制在变化字段上。
 *
 * @module core/view/viewGraph
 */

import { createComputed } from "../reactivity/computed"
import { maybeUseSchemxContext } from "../schemxContext"

import type { FieldRuntimeDiagnostics } from "../field/runtimeState"
import type { DescribedRuntimeNode, RuntimeNodeResourceContext } from "../node"
import type { ComputedSignal } from "../reactivity/computed"
import type { Signal } from "../reactivity/signal"
import type {
  SchemxComponentProps,
  SchemxResolvedBaseField,
  SchemxResolvedGroupField,
  Values,
} from "../types"
import type {
  SchemxViewDebugMeta,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
} from "./types"

/**
 * 字段节点视图状态。
 */
export interface FieldNodeViewState<TValues extends Values = Values> {
  /** 字段 ViewSchema computed */
  readonly view: ComputedSignal<SchemxViewFieldSchema<TValues> | null>
}

/**
 * 分组节点视图状态。
 */
export interface GroupViewState<TValues extends Values = Values> {
  /** 分组 ViewSchema computed */
  readonly view: ComputedSignal<SchemxViewGroupSchema<TValues> | null>
}

/**
 * Dependency 节点视图状态。
 */
export interface DependencyViewState<TValues extends Values = Values> {
  /** dependency 透明展开的 children ViewSchemas computed */
  readonly view: ComputedSignal<readonly SchemxViewSchema<TValues>[]>
}

/**
 * Root 节点视图状态。
 */
export interface RootViewState<TValues extends Values = Values> {
  /** 顶层 ViewSchemas computed */
  readonly viewSchemas: ComputedSignal<readonly SchemxViewSchema<TValues>[]>
}

export type RuntimeViewState<TValues extends Values = Values> =
  | FieldNodeViewState<TValues>
  | GroupViewState<TValues>
  | DependencyViewState<TValues>
  | RootViewState<TValues>

/**
 * 创建字段节点视图状态。
 *
 * @param viewSchema - 字段运行态的 viewSchema computed
 * @param nodeKey - 节点 key
 * @param nodeId - 节点 ID
 * @param diagnostics - 字段运行态诊断信息
 * @returns 字段节点视图状态
 */
export function createFieldNodeViewState<TValues extends Values = Values>(
  viewSchema: ComputedSignal<SchemxResolvedBaseField<TValues>>,
  nodeKey?: string,
  nodeId?: number,
  diagnostics?: Signal<FieldRuntimeDiagnostics<TValues>>
): FieldNodeViewState<TValues> {
  return {
    view: createComputed(() => {
      const schema = viewSchema.value
      const meta = diagnostics?.value

      return {
        ...schema,
        key: nodeKey ?? "",
        placeholder: sanitizePlaceholder(schema.placeholder ?? ""),
        componentProps: sanitizeComponentProps(schema.componentProps ?? {}),
        debug: buildFieldDebugMeta(nodeId, meta),
      } as SchemxViewFieldSchema<TValues>
    }),
  }
}

/**
 * 创建分组节点视图状态。
 *
 * @param groupSchema - 分组静态 schema
 * @param childrenView - children ViewSchemas computed
 * @param nodeKey - 节点 key
 * @param nodeId - 节点 ID
 * @returns 分组节点视图状态
 */
export function createGroupViewState<TValues extends Values = Values>(
  groupSchema: SchemxResolvedGroupField<TValues>,
  childrenView: ComputedSignal<readonly SchemxViewSchema<TValues>[]>,
  nodeKey?: string,
  nodeId?: number
): GroupViewState<TValues> {
  return {
    view: createComputed(() => {
      return {
        ...groupSchema,
        key: nodeKey ?? "",
        children: childrenView.value,
        debug: buildNodeDebugMeta(nodeId, "group", false, false),
      } as SchemxViewGroupSchema<TValues>
    }),
  }
}

/**
 * 创建 dependency 节点视图状态。
 *
 * dependency 透明展开 children，不输出自身 schema。
 *
 * @param childrenView - dynamic children ViewSchemas computed
 * @returns dependency 节点视图状态
 */
export function createDependencyViewState<TValues extends Values = Values>(
  childrenView: ComputedSignal<readonly SchemxViewSchema<TValues>[]>
): DependencyViewState<TValues> {
  return {
    view: createComputed(() => childrenView.value),
  }
}

/**
 * 创建 children ViewSchemas computed。
 *
 * @param childrenSignal - 当前容器的 runtime children signal
 * @returns children ViewSchemas computed
 */
export function createChildrenViewState<TValues extends Values = Values>(
  childrenSignal: Signal<readonly DescribedRuntimeNode<TValues>[]>,
  resources?: RuntimeNodeResourceContext<TValues>
): ComputedSignal<readonly SchemxViewSchema<TValues>[]> {
  return createComputed(() => {
    const result: SchemxViewSchema<TValues>[] = []

    for (const child of childrenSignal.value) {
      const view = readRuntimeNodeView(child, resources)

      if (view == null) {
        continue
      }

      if (Array.isArray(view)) {
        result.push(...(view as readonly SchemxViewSchema<TValues>[]))
      } else {
        result.push(view as SchemxViewSchema<TValues>)
      }
    }

    return result
  })
}

/**
 * 读取 runtime node 的 view 输出。
 *
 * @param node - runtime node
 * @returns 对应的 ViewSchema、ViewSchema 列表或 null
 */
export function readRuntimeNodeView<TValues extends Values = Values>(
  node: DescribedRuntimeNode<TValues>,
  resources = maybeUseSchemxContext<TValues>()?.nodeResources
): SchemxViewSchema<TValues> | readonly SchemxViewSchema<TValues>[] | null {
  if (node.disposed.value) {
    return null
  }

  if (!resources) {
    return null
  }

  const viewState = resources.viewStates.get(node.id)

  if (node.type === "field") {
    return hasNodeView(viewState) ? viewState.view.value ?? null : null
  }

  if (node.type === "group") {
    return hasNodeView(viewState) ? viewState.view.value ?? null : null
  }

  if (node.type === "dependency") {
    return hasNodeView(viewState) ? viewState.view.value ?? [] : []
  }

  return null
}

function hasNodeView<TValues extends Values>(
  viewState: RuntimeViewState<TValues> | undefined
): viewState is
  | FieldNodeViewState<TValues>
  | GroupViewState<TValues>
  | DependencyViewState<TValues> {
  return viewState != null && "view" in viewState
}

/**
 * 创建 root 节点视图状态。
 *
 * root 组合顶层 children view，自身不输出 schema。
 *
 * @param childrenSignal - 顶层 children 的响应式 signal
 * @returns root 节点视图状态
 */
export function createRootViewState<TValues extends Values = Values>(
  childrenSignal: Signal<readonly DescribedRuntimeNode<TValues>[]>,
  resources?: RuntimeNodeResourceContext<TValues>
): RootViewState<TValues> {
  return {
    viewSchemas: createChildrenViewState(childrenSignal, resources),
  }
}

/**
 * 读取 root 视图。
 *
 * @param root - root 节点视图状态
 * @returns 当前顶层 ViewSchemas
 */
export function readRootViewSchemas<TValues extends Values>(
  root: RootViewState<TValues>
): readonly SchemxViewSchema<TValues>[] {
  return root.viewSchemas.value
}

function buildFieldDebugMeta<TValues extends Values = Values>(
  nodeId: number | undefined,
  diagnostics: FieldRuntimeDiagnostics<TValues> | undefined
): Readonly<SchemxViewDebugMeta> {
  return {
    runtimeNodeId: nodeId ?? 0,
    runtimeNodeType: "field",
    hasRuntimeState: true,
    hasDependencyEffect: false,
    lastUpdatedBy: diagnostics?.lastUpdatedBy,
    overriddenKeys: diagnostics?.overriddenKeys,
    error: diagnostics?.error?.message ?? null,
  }
}

function buildNodeDebugMeta(
  nodeId: number | undefined,
  runtimeNodeType: string,
  hasRuntimeState: boolean,
  hasDependencyEffect: boolean
): Readonly<SchemxViewDebugMeta> {
  return {
    runtimeNodeId: nodeId ?? 0,
    runtimeNodeType,
    hasRuntimeState,
    hasDependencyEffect,
  }
}

function sanitizePlaceholder(value: string | undefined): string {
  if (!value) {
    return ""
  }

  return value.length > 1000 ? value.slice(0, 1000) : value
}

function sanitizeComponentProps<TValues extends Values = Values>(
  props: SchemxComponentProps<TValues>,
  depth = 0
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
      result[key] = sanitizeComponentProps(
        value as SchemxComponentProps<TValues>,
        depth + 1
      )
    } else {
      result[key] = value
    }
  }

  return result
}

function isValidPropKey(key: string): boolean {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
    return true
  }

  return /^[a-zA-Z0-9_-]+$/.test(key)
}
