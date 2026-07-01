import {
  createDependenciesEffect,
  createDependencyEffect,
  createFieldRuntimeState,
  createValidationEffect,
  type FieldRuntimeState,
  setFieldStaticSchema,
} from "../field"
import {
  createRuntimeViewState,
  deleteRuntimeViewState,
  updateRuntimeViewState,
} from "../view/createViewState"

import { getChildRuntimeNodes } from "./runtimeNode"

import type { DependencyDescriptor, FieldDescriptor, FormDescriptor } from "../descriptor"
import type { SchemxContext } from "../schemxContext"
import type { NamePath, Values } from "../types"
import type { DescribedRuntimeNode, RuntimeNode } from "./types"

export interface RuntimeLifecycle<TValues extends Values = Values> {
  mount(node: DescribedRuntimeNode<TValues>, descriptor: FormDescriptor<TValues>): void
  update(
    node: DescribedRuntimeNode<TValues>,
    previousDescriptor: FormDescriptor<TValues> | undefined,
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
    resources.descriptors.set(node.id, descriptor)
    bus.emitBeforeMount(node)

    mountRuntimeResources(node, descriptor)
    node.mounted.value = true

    bus.emitMount(node)
  }

  function update(
    node: DescribedRuntimeNode<TValues>,
    previousDescriptor: FormDescriptor<TValues> | undefined,
    nextDescriptor: FormDescriptor<TValues>
  ): void {
    if (node.type !== nextDescriptor.type) {
      throw new Error(
        `unexpected descriptor type: node ${node.type} cannot update with ${nextDescriptor.type}`
      )
    }

    const previousNode = { ...node }

    bus.emitBeforeUpdate(node, previousNode)
    resources.descriptors.set(node.id, nextDescriptor)
    updateRuntimeResources(node, previousDescriptor, nextDescriptor)
    bus.emitUpdate(node, previousNode)
    bus.emitUpdated(node, previousNode)
  }

  function unmountSubtree(node: RuntimeNode<TValues>): void {
    if (node.disposed.value) {
      return
    }

    for (const child of getChildRuntimeNodes(node)) {
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
      mountFieldResources(node, descriptor)

      return
    }

    if (node.type === "group" && descriptor.type === "group") {
      mountGroupResources(node, descriptor)

      return
    }

    if (node.type === "dependency" && descriptor.type === "dependency") {
      mountDependencyResources(node, descriptor)
    }
  }

  function updateRuntimeResources(
    node: DescribedRuntimeNode<TValues>,
    previousDescriptor: FormDescriptor<TValues> | undefined,
    nextDescriptor: FormDescriptor<TValues>
  ): void {
    if (node.type === "field" && nextDescriptor.type === "field") {
      updateFieldResources(
        node,
        nextDescriptor,
        previousDescriptor?.type === "field" ? previousDescriptor : undefined
      )

      return
    }

    if (node.type === "group" && nextDescriptor.type === "group") {
      mountGroupResources(node, nextDescriptor)

      return
    }

    if (node.type === "dependency" && nextDescriptor.type === "dependency") {
      updateDependencyResources(
        node,
        nextDescriptor,
        previousDescriptor?.type === "dependency" ? previousDescriptor : undefined
      )
    }
  }

  function mountFieldResources(
    node: Extract<RuntimeNode<TValues>, { type: "field" }>,
    descriptor: FieldDescriptor<TValues>
  ): void {
    const runtimeState = createFieldRuntimeState<TValues>({
      nodeId: node.id,
      key: node.key,
      descriptor,
    })

    applyFieldInitialValue(descriptor)
    resources.fieldStates.set(node.id, runtimeState)
    createRuntimeViewState(node, descriptor, resources)
    context.fieldRegistry.register({ name: descriptor.name, node })
    recreateFieldEffectScopes(node, descriptor, runtimeState)
  }

  function updateFieldResources(
    node: Extract<RuntimeNode<TValues>, { type: "field" }>,
    descriptor: FieldDescriptor<TValues>,
    previousDescriptor?: FieldDescriptor<TValues>
  ): void {
    const runtimeState = resources.fieldStates.get(node.id)

    if (!runtimeState) {
      mountFieldResources(node, descriptor)

      return
    }

    if (previousDescriptor && previousDescriptor.name !== descriptor.name) {
      context.fieldRegistry.unregister(previousDescriptor.name, node)
    }

    setFieldStaticSchema(runtimeState, descriptor)
    updateRuntimeViewState(node, descriptor, resources)
    context.fieldRegistry.register({ name: descriptor.name, node })
    recreateFieldEffectScopes(node, descriptor, runtimeState)
  }

  function recreateFieldEffectScopes(
    node: Extract<RuntimeNode<TValues>, { type: "field" }>,
    descriptor: FieldDescriptor<TValues>,
    runtimeState: FieldRuntimeState<TValues>
  ): void {
    resources.fieldResourceScopes.get(node.id)?.dispose()
    resources.fieldDynamicPropScopes.get(node.id)?.dispose()

    const validationScope = node.scope.child()
    const dynamicPropScope = node.scope.child()

    resources.fieldResourceScopes.set(node.id, validationScope)
    resources.fieldDynamicPropScopes.set(node.id, dynamicPropScope)

    validationScope.add(() => {
      if (resources.fieldResourceScopes.get(node.id) === validationScope) {
        resources.fieldResourceScopes.delete(node.id)
      }
    })
    dynamicPropScope.add(() => {
      if (resources.fieldDynamicPropScopes.get(node.id) === dynamicPropScope) {
        resources.fieldDynamicPropScopes.delete(node.id)
      }
    })

    createValidationEffect({
      context,
      name: descriptor.name,
      effectiveSchema: runtimeState.effectiveSchema,
      scope: validationScope,
    })
    createDependenciesEffect({
      context,
      descriptor,
      runtimeState,
      scope: dynamicPropScope,
    })
  }

  function mountGroupResources(
    node: Extract<RuntimeNode<TValues>, { type: "group" }>,
    descriptor: Extract<FormDescriptor<TValues>, { type: "group" }>
  ): void {
    createRuntimeViewState(node, descriptor, resources)
  }

  function mountDependencyResources(
    node: Extract<RuntimeNode<TValues>, { type: "dependency" }>,
    descriptor: DependencyDescriptor<TValues>
  ): void {
    createRuntimeViewState(node, descriptor, resources)
    createDependencyEffect({
      context,
      node,
      descriptor,
      scope: node.scope.child(),
    })
  }

  function updateDependencyResources(
    node: Extract<RuntimeNode<TValues>, { type: "dependency" }>,
    descriptor: DependencyDescriptor<TValues>,
    previousDescriptor?: DependencyDescriptor<TValues>
  ): void {
    createRuntimeViewState(node, descriptor, resources)

    if (
      previousDescriptor &&
      hasSameTriggerFields(previousDescriptor.triggerFields, descriptor.triggerFields) &&
      resources.dependencyEffects.has(node.id)
    ) {
      return
    }

    resources.dependencyResourceScopes.get(node.id)?.dispose()
    createDependencyEffect({
      context,
      node,
      descriptor,
      scope: node.scope.child(),
    })
  }

  function unmountRuntimeResources(node: RuntimeNode<TValues>): void {
    const descriptor = resources.descriptors.get(node.id)

    deleteRuntimeViewState(node, resources)

    if (node.type === "field" && descriptor?.type === "field") {
      context.fieldRegistry.unregister(descriptor.name, node)
      resources.fieldResourceScopes.get(node.id)?.dispose()
      resources.fieldDynamicPropScopes.get(node.id)?.dispose()
    } else if (node.type === "dependency") {
      resources.dependencyResourceScopes.get(node.id)?.dispose()
    }
  }

  function applyFieldInitialValue(descriptor: FieldDescriptor<TValues>): void {
    if (!Object.hasOwn(descriptor.staticSchema, "initialValue")) {
      return
    }

    if (context.instance.getFieldValue(descriptor.name) !== undefined) {
      return
    }

    context.instance.setFieldValue(
      descriptor.name,
      descriptor.staticSchema.initialValue as never
    )
  }
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
