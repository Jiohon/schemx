import {
  mountDependencyNodeResources,
  mountFieldNodeResources,
  unmountDependencyNodeResources,
  unmountFieldNodeResources,
  updateDependencyNodeResources,
  updateFieldNodeResources,
} from "../field"
import { createRuntimeViewState, deleteRuntimeViewState } from "../view/createViewState"


import type { FormDescriptor } from "../descriptor"
import type { SchemxContext } from "../schemxContext"
import type { Values } from "../types"
import type { DescribedRuntimeNode, RuntimeNode } from "./types"

export interface RuntimeLifecycle<TValues extends Values = Values> {
  mount(node: DescribedRuntimeNode<TValues>, descriptor: FormDescriptor<TValues>): void
  update(
    node: DescribedRuntimeNode<TValues>,
    previousDescriptor: FormDescriptor<TValues> | null,
    nextDescriptor: FormDescriptor<TValues>
  ): void
  unmount(node: RuntimeNode<TValues>): void
  unmountSubtree(node: RuntimeNode<TValues>): void
}

export function createRuntimeLifecycle<TValues extends Values = Values>(
  context: SchemxContext<TValues>
): RuntimeLifecycle<TValues> {
  const resources = context.nodeResources
  const bus = context.lifecycleBus

  return {
    mount,
    update,
    unmount,
    unmountSubtree,
  }

  function mount(
    node: DescribedRuntimeNode<TValues>,
    descriptor: FormDescriptor<TValues>
  ): void {
    node.descriptor = descriptor
    bus.emitBeforeMount(node)

    mountRuntimeResources(node, descriptor)
    node.mounted.value = true

    bus.emitMount(node)
  }

  function update(
    node: DescribedRuntimeNode<TValues>,
    previousDescriptor: FormDescriptor<TValues> | null,
    nextDescriptor: FormDescriptor<TValues>
  ): void {
    if (node.type !== nextDescriptor.type) {
      throw new Error(
        `unexpected descriptor type: node ${node.type} cannot update with ${nextDescriptor.type}`
      )
    }

    const previousNode = { ...node }

    bus.emitBeforeUpdate(node, previousNode)
    node.descriptor = nextDescriptor
    updateRuntimeResources(node, previousDescriptor, nextDescriptor)
    bus.emitUpdate(node, previousNode)
    bus.emitUpdated(node, previousNode)
  }

  function unmountSubtree(node: RuntimeNode<TValues>): void {
    if (node.disposed.value) {
      return
    }

    for (const child of (node.type === "field" ? [] : node.childNodes.value)) {
      unmountSubtree(child)
    }

    unmount(node)
  }

  function unmount(node: RuntimeNode<TValues>): void {
    if (node.type === "root") {
      return
    }

    bus.emitBeforeUnmount(node)
    unmountRuntimeResources(node)
    bus.emitUnmount(node)
  }

  function mountRuntimeResources(
    node: DescribedRuntimeNode<TValues>,
    descriptor: FormDescriptor<TValues>
  ): void {
    if (node.type === "field" && descriptor.type === "field") {
      mountFieldNodeResources(node, descriptor, context)

      return
    }

    if (node.type === "group" && descriptor.type === "group") {
      mountGroupResources(node, descriptor)

      return
    }

    if (node.type === "dependency" && descriptor.type === "dependency") {
      mountDependencyNodeResources(node, descriptor, context)
    }
  }

  function updateRuntimeResources(
    node: DescribedRuntimeNode<TValues>,
    previousDescriptor: FormDescriptor<TValues> | null,
    nextDescriptor: FormDescriptor<TValues>
  ): void {
    if (node.type === "field" && nextDescriptor.type === "field") {
      updateFieldNodeResources(
        node,
        previousDescriptor?.type === "field" ? previousDescriptor : undefined,
        nextDescriptor,
        context
      )

      return
    }

    if (node.type === "group" && nextDescriptor.type === "group") {
      mountGroupResources(node, nextDescriptor)

      return
    }

    if (node.type === "dependency" && nextDescriptor.type === "dependency") {
      updateDependencyNodeResources(
        node,
        previousDescriptor?.type === "dependency" ? previousDescriptor : undefined,
        nextDescriptor,
        context
      )
    }
  }

  function mountGroupResources(
    node: Extract<RuntimeNode<TValues>, { type: "group" }>,
    descriptor: Extract<FormDescriptor<TValues>, { type: "group" }>
  ): void {
    createRuntimeViewState(node, descriptor, resources)
  }

  function unmountRuntimeResources(node: RuntimeNode<TValues>): void {
    const descriptor = node.type === "root" ? undefined : node.descriptor ?? undefined

    deleteRuntimeViewState(node, resources)

    if (node.type === "field" && descriptor?.type === "field") {
      unmountFieldNodeResources(node, context)
    } else if (node.type === "dependency") {
      unmountDependencyNodeResources(node, context)
    }
  }
}
