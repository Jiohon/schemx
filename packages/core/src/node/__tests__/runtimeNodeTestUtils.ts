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
    scope?: Scope
  } = {}
): RootRuntimeNode {
  const root = createRootRuntimeNode({ scope: options.scope ?? createScope() })

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
  scope?: Scope
}): FieldRuntimeNode {
  return createFieldRuntimeNode({
    id: options.id ?? 1,
    key: options.key,
    parent: options.parent,
    scope: options.scope ?? options.parent.scope.child(),
  })
}

export function createTestGroupRuntimeNode(options: {
  id?: number
  key: string
  parent: ContainerRuntimeNode
  descriptor: GroupDescriptor
  scope?: Scope
}): GroupRuntimeNode {
  return createGroupRuntimeNode({
    id: options.id ?? 1,
    key: options.key,
    parent: options.parent,
    scope: options.scope ?? options.parent.scope.child(),
  })
}

export function createTestDependencyRuntimeNode(options: {
  id?: number
  key: string
  parent: ContainerRuntimeNode
  descriptor: DependencyDescriptor
  scope?: Scope
}): DependencyRuntimeNode {
  return createDependencyRuntimeNode({
    id: options.id ?? 1,
    key: options.key,
    parent: options.parent,
    scope: options.scope ?? options.parent.scope.child(),
  })
}
