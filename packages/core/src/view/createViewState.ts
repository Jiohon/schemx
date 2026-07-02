import {
  createChildrenViewState,
  createDependencyViewState,
  createFieldNodeViewState,
  createGroupViewState,
  createRootViewState,
} from "./viewGraph"

import type {
  DependencyDescriptor,
  FieldDescriptor,
  FormDescriptor,
  GroupDescriptor,
} from "../descriptor"
import type {
  ContainerRuntimeNode,
  DescribedRuntimeNode,
  RootRuntimeNode,
  RuntimeChildrenState,
  RuntimeNode,
  RuntimeNodeResourceContext,
} from "../node"
import type { Values } from "../types"
import type { RootViewState, RuntimeViewState } from "./viewGraph"

/**
 * 为 root 创建并注册 ViewState。
 */
export function createRootRuntimeViewState<TValues extends Values = Values>(
  root: RootRuntimeNode<TValues>,
  resources: RuntimeNodeResourceContext<TValues>
): RootViewState<TValues> {
  const childrenState = getChildrenState(root, resources)
  const viewState = createRootViewState<TValues>(
    childrenState.children,
    resources
  )

  resources.viewStates.set(root.id, viewState)

  return viewState
}

/**
 * 为 RuntimeNode 创建并注册对应 ViewState。
 */
export function createRuntimeViewState<TValues extends Values = Values>(
  node: DescribedRuntimeNode<TValues>,
  descriptor: FormDescriptor<TValues>,
  resources: RuntimeNodeResourceContext<TValues>
): RuntimeViewState<TValues> {
  if (node.type === "field" && descriptor.type === "field") {
    return createFieldRuntimeViewState(node, descriptor, resources)
  }

  if (node.type === "group" && descriptor.type === "group") {
    return createGroupRuntimeViewState(node, descriptor, resources)
  }

  if (node.type === "dependency" && descriptor.type === "dependency") {
    return createDependencyRuntimeViewState(node, descriptor, resources)
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
  resources: RuntimeNodeResourceContext<TValues>
): void {
  resources.viewStates.delete(node.id)
}

function createFieldRuntimeViewState<TValues extends Values>(
  node: Extract<RuntimeNode<TValues>, { type: "field" }>,
  descriptor: FieldDescriptor<TValues>,
  resources: RuntimeNodeResourceContext<TValues>
): RuntimeViewState<TValues> {
  const runtimeState = resources.fieldStates.get(node.id)

  if (!runtimeState) {
    throw new Error(`[schemx] fieldState is required for node "${node.key}"`)
  }

  const viewState = createFieldNodeViewState<TValues>(
    runtimeState.viewSchema,
    node.key,
    node.id,
    runtimeState.diagnostics
  )

  resources.viewStates.set(node.id, viewState)

  return viewState
}

function createGroupRuntimeViewState<TValues extends Values>(
  node: Extract<RuntimeNode<TValues>, { type: "group" }>,
  descriptor: GroupDescriptor<TValues>,
  resources: RuntimeNodeResourceContext<TValues>
): RuntimeViewState<TValues> {
  const viewState = createGroupViewState<TValues>(
    descriptor.staticSchema,
    createChildrenViewState<TValues>(
      getChildrenState(node, resources).children,
      resources
    ),
    node.key,
    node.id
  )

  resources.viewStates.set(node.id, viewState)

  return viewState
}

function createDependencyRuntimeViewState<TValues extends Values>(
  node: Extract<RuntimeNode<TValues>, { type: "dependency" }>,
  _descriptor: DependencyDescriptor<TValues>,
  resources: RuntimeNodeResourceContext<TValues>
): RuntimeViewState<TValues> {
  const viewState = createDependencyViewState<TValues>(
    createChildrenViewState<TValues>(
      getChildrenState(node, resources).children,
      resources
    )
  )

  resources.viewStates.set(node.id, viewState)

  return viewState
}

function getChildrenState<TValues extends Values>(
  node: ContainerRuntimeNode<TValues>,
  resources: RuntimeNodeResourceContext<TValues>
): RuntimeChildrenState<TValues> {
  const childrenState = resources.childrenStates.get(node.id)

  if (!childrenState) {
    throw new Error(`[schemx] childrenState is required for node "${node.key}"`)
  }

  return childrenState
}
