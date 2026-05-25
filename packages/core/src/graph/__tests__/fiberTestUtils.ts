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
import type { RuntimeScope } from "../scope"

export function createTestRootFiber(
  options: {
    id?: number
    key?: string
    scope?: RuntimeScope
  } = {}
): RootFiber {
  return {
    id: options.id ?? 0,
    key: options.key ?? "root",
    kind: "root",
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
  scope?: RuntimeScope
}): FieldFiber {
  return {
    id: options.id ?? 1,
    key: options.key,
    kind: "field",
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
  scope?: RuntimeScope
}): GroupFiber {
  return {
    id: options.id ?? 1,
    key: options.key,
    kind: "group",
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
  scope?: RuntimeScope
}): DependencyFiber {
  return {
    id: options.id ?? 1,
    key: options.key,
    kind: "dependency",
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
