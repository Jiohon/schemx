/**
 * RuntimeNode ViewState 生命周期与 computed ViewSchema 图。
 *
 * ViewState 挂在 runtime node 上，增删改查维护 computed 图节点；
 * 读取 root viewSchemas 时直接取 root computed 的当前值。
 *
 * @module core/view/createViewState
 */

import { createComputed } from "../reactivity/computed"

import {
  isDependencyDescriptor,
  isFieldDescriptor,
  isGroupDescriptor,
  type FormDescriptor,
} from "../descriptor"
import type {
  DescribedRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
  RuntimeNodeResourceContext,
} from "../node"
import type {
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
} from "./types"
import type { ComputedSignal } from "../reactivity/computed"
import type { SchemxComponentProps, Values } from "../types"
import {
  isDependencyRuntimeNode,
  isFieldRuntimeNode,
  isGroupRuntimeNode,
} from "@/node/helper"

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
 * 为 root 创建并注册 ViewState。
 */
export function createRootRuntimeViewState<TValues extends Values = Values>(
  root: RootRuntimeNode<TValues>,
  _resources: RuntimeNodeResourceContext<TValues>
): RootViewState<TValues> {
  const viewState: RootViewState<TValues> = {
    viewSchemas: createComputed(() => readChildrenViewSchemas(root.childNodes.value)),
  }

  root.viewState = viewState

  return viewState
}

/**
 * 为 RuntimeNode 创建并注册对应 ViewState。
 */
export function createRuntimeViewState<TValues extends Values = Values>(
  node: DescribedRuntimeNode<TValues>,
  descriptor: FormDescriptor<TValues>,
  _resources: RuntimeNodeResourceContext<TValues>
): RuntimeViewState<TValues> {
  if (node.type !== descriptor.type) {
    throw new Error(
      `[schemx] Cannot create viewState for node "${node.key}" with descriptor "${descriptor.type}".`
    )
  }

  if (isFieldRuntimeNode(node) && isFieldDescriptor(descriptor)) {
    const runtimeState = node.fieldState

    if (!runtimeState) {
      throw new Error(`[schemx] fieldState is required for node "${node.key}"`)
    }

    const viewState: FieldNodeViewState<TValues> = {
      view: createComputed(() => {
        const schema = runtimeState.viewSchema.value
        const diagnostics = runtimeState.diagnostics.value

        return {
          ...schema,
          key: node.key,
          placeholder: sanitizePlaceholder(schema.placeholder),
          componentProps: sanitizeComponentProps(schema.componentProps ?? {}),
          debug: {
            runtimeNodeId: node.id,
            runtimeNodeType: "field",
            hasRuntimeState: true,
            hasDependencyEffect: false,
            lastUpdatedBy: diagnostics.lastUpdatedBy,
            overriddenKeys: diagnostics.overriddenKeys,
            error: diagnostics.error?.message ?? null,
          },
        } as SchemxViewFieldSchema<TValues>
      }),
    }

    node.viewState = viewState

    return viewState
  }

  if (isGroupRuntimeNode(node) && isGroupDescriptor(descriptor)) {
    const viewState: GroupViewState<TValues> = {
      view: createComputed(() => {
        return {
          ...descriptor.staticSchema,
          key: node.key,
          children: readChildrenViewSchemas(node.childNodes.value),
          debug: {
            runtimeNodeId: node.id,
            runtimeNodeType: "group",
            hasRuntimeState: false,
            hasDependencyEffect: false,
          },
        } as SchemxViewGroupSchema<TValues>
      }),
    }

    node.viewState = viewState

    return viewState
  }

  if (isDependencyRuntimeNode(node) && isDependencyDescriptor(descriptor)) {
    const viewState: DependencyViewState<TValues> = {
      view: createComputed(() => readChildrenViewSchemas(node.childNodes.value)),
    }

    node.viewState = viewState

    return viewState
  }

  throw new Error(
    `[schemx] Cannot create viewState for node "${node.key}" with descriptor "${descriptor.type}".`
  )
}

/**
 * 更新 RuntimeNode 对应 ViewState。
 */
export function updateRuntimeViewState<TValues extends Values = Values>(
  node: DescribedRuntimeNode<TValues>,
  descriptor: FormDescriptor<TValues>,
  resources: RuntimeNodeResourceContext<TValues>
): RuntimeViewState<TValues> {
  return createRuntimeViewState(node, descriptor, resources)
}

/**
 * 删除 RuntimeNode 对应 ViewState。
 */
export function deleteRuntimeViewState<TValues extends Values = Values>(
  node: RuntimeNode<TValues>,
  _resources: RuntimeNodeResourceContext<TValues>
): void {
  node.viewState = null
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

function readChildrenViewSchemas<TValues extends Values>(
  children: readonly DescribedRuntimeNode<TValues>[]
): readonly SchemxViewSchema<TValues>[] {
  const result: SchemxViewSchema<TValues>[] = []

  for (const child of children) {
    if (child.disposed.value || !child.viewState || !("view" in child.viewState)) {
      continue
    }

    const view = child.viewState.view.value

    if (Array.isArray(view)) {
      result.push(...(view as readonly SchemxViewSchema<TValues>[]))
    } else if (view) {
      result.push(view as SchemxViewSchema<TValues>)
    }
  }

  return result
}

function sanitizePlaceholder(value: string | undefined): string {
  return value ? value.slice(0, 1000) : ""
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
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) && !/^[a-zA-Z0-9_-]+$/.test(key)) {
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
