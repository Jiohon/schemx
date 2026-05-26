import { createSignal } from "../../reactivity"
import { createScope } from "../scope"

import type {
  DependencyDescriptor,
  FieldDescriptor,
  GroupDescriptor,
} from "../../descriptor"
import type {
  ContainerFiber,
  DependencyFiber,
  FieldFiber,
  GroupFiber,
  RootFiber,
} from "../fiber"
import type { Scope } from "../scope"

export function createTestRootFiber(
  options: {
    id?: number
    key?: string
    scope?: Scope
  } = {}
): RootFiber {
  return {
    id: options.id ?? 0,
    key: options.key ?? "root",
    type: "root",
    parent: null,
    scope: options.scope ?? createScope(),
    disposed: createSignal(false),
    mounted: createSignal(false),
    childFibers: [],
  }
}

export function createTestFieldFiber(options: {
  id?: number
  key: string
  parent: ContainerFiber
  descriptor: FieldDescriptor
  scope?: Scope
}): FieldFiber {
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
  }
}

export function createTestGroupFiber(options: {
  id?: number
  key: string
  parent: ContainerFiber
  descriptor: GroupDescriptor
  scope?: Scope
}): GroupFiber {
  return {
    id: options.id ?? 1,
    key: options.key,
    type: "group",
    parent: options.parent,
    scope: options.scope ?? options.parent.scope.child(),
    disposed: createSignal(false),
    mounted: createSignal(false),
    descriptor: options.descriptor,
    childFibers: [],
  }
}

export function createTestDependencyFiber(options: {
  id?: number
  key: string
  parent: ContainerFiber
  descriptor: DependencyDescriptor
  scope?: Scope
}): DependencyFiber {
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
    subChildren: [],
  }
}
