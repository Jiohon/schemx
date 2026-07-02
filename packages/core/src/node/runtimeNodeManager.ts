/**
 * RuntimeNodeManager - runtime tree 结构管理器。
 *
 * 该模块只维护 RuntimeNode tree 和 `nodes` Map 的一致性，不挂载 descriptor、
 * field state、dependency effect、validation effect 或 view state。
 *
 * @module core/node/runtimeNodeManager
 */

import { createSignal } from "../reactivity"

import { deleteNodeResources } from "./resources"
import {
  createDependencyRuntimeNode,
  createFieldRuntimeNode,
  createGroupRuntimeNode,
  createRootRuntimeNode,
  getChildRuntimeNodes,
  setChildRuntimeNodes,
} from "./runtimeNode"
import { createScope } from "./scope"

import type { FormDescriptor } from "../descriptor"
import type { SchemxContext } from "../schemxContext"
import type { Values } from "../types"
import type {
  ContainerRuntimeNode,
  CreateRuntimeNodeOptions,
  DescribedRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
  RuntimeNodeManager,
  RuntimeNodeResourceContext,
} from "./types"

export function createRuntimeNodeManager<TValues extends Values = Values>(
  context: SchemxContext<TValues>
): RuntimeNodeManager<TValues> {
  const resources = context.nodeResources

  let nextId = 1

  const manager: RuntimeNodeManager<TValues> = {
    resources,
    nodes: resources.nodes,
    createRoot,
    create,
    createNode,
    getNode,
    traverse,
    insertChild,
    replaceChildren,
    removeChild,
    removeSubtree,
  }

  return manager

  function createRoot(): RootRuntimeNode<TValues> {
    const node = createRootRuntimeNode<TValues>({ scope: createScope() })

    registerNode(resources, node)
    ensureChildrenState(node)

    return node
  }

  function create(
    descriptor: FormDescriptor<TValues>,
    parent: ContainerRuntimeNode<TValues>
  ): DescribedRuntimeNode<TValues> {
    const node = createNode({
      type: descriptor.type,
      key: descriptor.key,
      scope: parent.scope.child(),
    })

    node.parent = parent

    if (node.type !== "field") {
      ensureChildrenState(node)
    }

    return node
  }

  function createNode(
    createOptions: CreateRuntimeNodeOptions
  ): DescribedRuntimeNode<TValues> {
    const nodeId = nextId++
    const scope = createOptions.scope ?? createScope()
    const baseOptions = {
      id: nodeId,
      key: createOptions.key,
      scope,
    }

    let node = {} as DescribedRuntimeNode<TValues>

    if (createOptions.type === "field") {
      node = createFieldRuntimeNode<TValues>(baseOptions)
    } else if (createOptions.type === "group") {
      node = createGroupRuntimeNode<TValues>(baseOptions)
    } else {
      node = createDependencyRuntimeNode<TValues>(baseOptions)
    }

    registerNode(resources, node)

    if (node.type !== "field") {
      ensureChildrenState(node)
    }

    return node
  }

  function getNode(nodeId: number): RuntimeNode<TValues> | undefined {
    return resources.nodes.get(nodeId)
  }

  function traverse(root: RuntimeNode<TValues>): RuntimeNode<TValues>[] {
    const result: RuntimeNode<TValues>[] = []
    const visit = (node: RuntimeNode<TValues>): void => {
      result.push(node)

      for (const child of getChildRuntimeNodes(node)) {
        visit(child)
      }
    }

    visit(root)

    return result
  }

  function insertChild(
    parent: ContainerRuntimeNode<TValues>,
    child: DescribedRuntimeNode<TValues>,
    index = getChildRuntimeNodes(parent).length
  ): void {
    if (child.parent) {
      detachChild(child.parent, child)
    }

    const currentChildren = getChildRuntimeNodes(parent).filter(
      (current) => current !== child
    )
    const nextChildren = [...currentChildren]
    const normalizedIndex = Math.max(0, Math.min(index, nextChildren.length))

    nextChildren.splice(normalizedIndex, 0, child)
    child.parent = parent
    setChildren(parent, nextChildren)
  }

  function replaceChildren(
    parent: ContainerRuntimeNode<TValues>,
    children: readonly DescribedRuntimeNode<TValues>[]
  ): void {
    const currentChildren = getChildRuntimeNodes(parent)
    const nextChildren = Array.from(new Set(children))
    const nextSet = new Set(nextChildren)

    for (const child of currentChildren) {
      if (!nextSet.has(child)) {
        child.parent = null
      }
    }

    for (const child of nextChildren) {
      if (child.parent && child.parent !== parent) {
        detachChild(child.parent, child)
      }

      child.parent = parent
    }

    setChildren(parent, nextChildren)
  }

  function removeChild(
    parent: ContainerRuntimeNode<TValues>,
    child: DescribedRuntimeNode<TValues>
  ): void {
    detachChild(parent, child)
  }

  function removeSubtree(node: RuntimeNode<TValues>): void {
    for (const child of getChildRuntimeNodes(node)) {
      removeSubtree(child)
    }

    if (node.type !== "field") {
      setChildren(node, [])
    }

    if (node.parent) {
      detachChild(node.parent, node as DescribedRuntimeNode<TValues>)
    }

    node.parent = null
    node.disposed.value = true
    node.scope.dispose()
    deleteNodeResources(resources, node.id)
  }

  function detachChild(
    parent: ContainerRuntimeNode<TValues>,
    child: DescribedRuntimeNode<TValues>
  ): void {
    const nextChildren = getChildRuntimeNodes(parent).filter(
      (current) => current !== child
    )

    setChildren(parent, nextChildren)

    if (child.parent === parent) {
      child.parent = null
    }
  }

  function ensureChildrenState(node: ContainerRuntimeNode<TValues>) {
    let state = resources.childrenStates.get(node.id)

    if (!state) {
      state = {
        children: createSignal<readonly DescribedRuntimeNode<TValues>[]>(
          getChildRuntimeNodes(node)
        ),
      }
      resources.childrenStates.set(node.id, state)
    }

    return state
  }

  function setChildren(
    node: ContainerRuntimeNode<TValues>,
    children: DescribedRuntimeNode<TValues>[]
  ): void {
    setChildRuntimeNodes(node, children)
    ensureChildrenState(node).children.value = children
  }
}


function registerNode<TValues extends Values>(
  resources: RuntimeNodeResourceContext<TValues>,
  node: RuntimeNode<TValues>
): void {
  resources.nodes.set(node.id, node)
}
