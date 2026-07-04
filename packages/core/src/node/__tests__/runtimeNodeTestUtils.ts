import {
  createDependencyRuntimeNode,
  createFieldRuntimeNode,
  createGroupRuntimeNode,
  createRootRuntimeNode,
} from "../runtimeNode"
import { createScope } from "../scope"

import type {
  DependencyDescriptor,
  FieldDescriptor,
  GroupDescriptor,
} from "../../descriptor"
import type {
  ContainerRuntimeNode,
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RootRuntimeNode,
  Scope,
} from "../types"

export function createTestRootRuntimeNode(
  options: {
    id?: number
    key?: string
    dispose?: RuntimeDispose
  } = {}
): RootRuntimeNode {
  const root = createRootRuntimeNode({ dispose: options.dispose ?? createScope() })

  return {
    ...root,
    id: options.id ?? root.id,
    key: options.key ?? root.key,
  }
}

export function createTestFieldRuntimeNode(options: {
  id?: number
  key: string
  parent: ContainerRuntimeNode
  descriptor: FieldDescriptor
  dispose?: RuntimeDispose
}): FieldRuntimeNode {
  return createFieldRuntimeNode({
    id: options.id ?? 1,
    key: options.key,
    parent: options.parent,
    dispose: options.dispose ?? options.parent.dispose.child(),
  })
}

export function createTestGroupRuntimeNode(options: {
  id?: number
  key: string
  parent: ContainerRuntimeNode
  descriptor: GroupDescriptor
  dispose?: RuntimeDispose
}): GroupRuntimeNode {
  return createGroupRuntimeNode({
    id: options.id ?? 1,
    key: options.key,
    parent: options.parent,
    dispose: options.dispose ?? options.parent.dispose.child(),
  })
}

export function createTestDependencyRuntimeNode(options: {
  id?: number
  key: string
  parent: ContainerRuntimeNode
  descriptor: DependencyDescriptor
  dispose?: RuntimeDispose
}): DependencyRuntimeNode {
  return createDependencyRuntimeNode({
    id: options.id ?? 1,
    key: options.key,
    parent: options.parent,
    dispose: options.dispose ?? options.parent.dispose.child(),
  })
}
