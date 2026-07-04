import { createRuntimeViewState } from "../view/createViewState"

import { createDependencyEffect } from "./dependencyEffect"

import type { DependencyDescriptor } from "../descriptor"
import type { DependencyRuntimeNode } from "../node"
import type { SchemxContext } from "../schemxContext"
import type { NamePath, Values } from "../types"

export function mountDependencyNodeResources<TValues extends Values>(
  node: DependencyRuntimeNode<TValues>,
  descriptor: DependencyDescriptor<TValues>,
  context: SchemxContext<TValues>
): void {
  const resources = context.nodeResources

  createRuntimeViewState(node, descriptor, resources)
  resources.dependencyIndex.register(node)
  createDependencyEffect({
    context,
    node,
    descriptor,
    scope: node.dispose.child(),
  })
}

export function updateDependencyNodeResources<TValues extends Values>(
  node: DependencyRuntimeNode<TValues>,
  previousDescriptor: DependencyDescriptor<TValues> | undefined,
  nextDescriptor: DependencyDescriptor<TValues>,
  context: SchemxContext<TValues>
): void {
  const resources = context.nodeResources

  createRuntimeViewState(node, nextDescriptor, resources)

  if (
    previousDescriptor &&
    hasSameTriggerFields(previousDescriptor.triggerFields, nextDescriptor.triggerFields) &&
    node.effectState
  ) {
    return
  }

  resources.dependencyIndex.unregister(node)
  node.dependencyDispose?.dispose()
  node.dependencyDispose = null
  node.effectState = null
  resources.dependencyIndex.register(node)
  createDependencyEffect({
    context,
    node,
    descriptor: nextDescriptor,
    scope: node.dispose.child(),
  })
}

export function unmountDependencyNodeResources<TValues extends Values>(
  node: DependencyRuntimeNode<TValues>,
  context: SchemxContext<TValues>
): void {
  context.nodeResources.dependencyIndex.unregister(node)
  node.dependencyDispose?.dispose()
  node.dependencyDispose = null
  node.effectState = null
}

function hasSameTriggerFields<TValues extends Values>(
  previous: readonly NamePath<TValues>[],
  next: readonly NamePath<TValues>[]
): boolean {
  if (previous.length !== next.length) {
    return false
  }

  return previous.every((field, index) => isSameNamePath(field, next[index]))
}

function isSameNamePath<TValues extends Values>(
  previous: NamePath<TValues>,
  next: NamePath<TValues> | undefined
): boolean {
  if (next === undefined) {
    return false
  }

  if (Array.isArray(previous) || Array.isArray(next)) {
    return (
      Array.isArray(previous) &&
      Array.isArray(next) &&
      previous.length === next.length &&
      previous.every((part, index) => part === next[index])
    )
  }

  return previous === next
}
