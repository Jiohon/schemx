import { createSignal } from "../../reactivity"
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
} from "../runtimeNode"
import type { Scope } from "../scope"

export function createTestRootRuntimeNode(
  options: {
    id?: number
    key?: string
    scope?: Scope
  } = {}
): RootRuntimeNode {
  return {
    id: options.id ?? 0,
    key: options.key ?? "root",
    type: "root",
    parent: null,
    scope: options.scope ?? createScope(),
    disposed: createSignal(false),
    mounted: createSignal(false),
    childNodes: [],
    childrenState: null,
    viewState: null,
  }
}

export function createTestFieldRuntimeNode(options: {
  id?: number
  key: string
  parent: ContainerRuntimeNode
  descriptor: FieldDescriptor
  scope?: Scope
}): FieldRuntimeNode {
  return {
    id: options.id ?? 1,
    key: options.key,
    type: "field",
    parent: options.parent,
    scope: options.scope ?? options.parent.scope.child(),
    disposed: createSignal(false),
    mounted: createSignal(false),
    descriptor: options.descriptor,
    fieldModel: null,
    fieldResourceScope: null,
    fieldDependenciesScope: null,
    runtimeState: null,
    viewState: null,
  }
}

export function createTestGroupRuntimeNode(options: {
  id?: number
  key: string
  parent: ContainerRuntimeNode
  descriptor: GroupDescriptor
  scope?: Scope
}): GroupRuntimeNode {
  return {
    id: options.id ?? 1,
    key: options.key,
    type: "group",
    parent: options.parent,
    scope: options.scope ?? options.parent.scope.child(),
    disposed: createSignal(false),
    mounted: createSignal(false),
    descriptor: options.descriptor,
    childNodes: [],
    childrenState: null,
    viewState: null,
  }
}

export function createTestDependencyRuntimeNode(options: {
  id?: number
  key: string
  parent: ContainerRuntimeNode
  descriptor: DependencyDescriptor
  scope?: Scope
}): DependencyRuntimeNode {
  return {
    id: options.id ?? 1,
    key: options.key,
    type: "dependency",
    parent: options.parent,
    scope: options.scope ?? options.parent.scope.child(),
    disposed: createSignal(false),
    mounted: createSignal(false),
    descriptor: options.descriptor,
    dependencySlot: null,
    dependencyResourceScope: null,
    dynamicChildNodes: [],
    childrenState: null,
    viewState: null,
  }
}
