import { createRuntimeViewState, updateRuntimeViewState } from "../view/createViewState"

import { createDependenciesEffect } from "./dependenciesEffect"
import { createFieldRuntimeState, setFieldStaticSchema } from "./runtimeState"
import { createValidationEffect } from "./validationEffect"

import type { FieldDescriptor } from "../descriptor"
import type { FieldRuntimeNode } from "../node"
import type { SchemxContext } from "../schemxContext"
import type { Values } from "../types"
import type { FieldRuntimeState } from "./runtimeState"

export function mountFieldNodeResources<TValues extends Values>(
  node: FieldRuntimeNode<TValues>,
  descriptor: FieldDescriptor<TValues>,
  context: SchemxContext<TValues>
): void {
  const resources = context.nodeResources
  const runtimeState = createFieldRuntimeState<TValues>({
    nodeId: node.id,
    key: node.key,
    descriptor,
  })

  applyFieldInitialValue(descriptor, context)
  node.fieldState = runtimeState
  createRuntimeViewState(node, descriptor, resources)
  resources.fieldIndex.register(node)
  recreateFieldEffects(node, descriptor, runtimeState, context)
}

export function updateFieldNodeResources<TValues extends Values>(
  node: FieldRuntimeNode<TValues>,
  previousDescriptor: FieldDescriptor<TValues> | undefined,
  nextDescriptor: FieldDescriptor<TValues>,
  context: SchemxContext<TValues>
): void {
  const resources = context.nodeResources
  const runtimeState = node.fieldState

  if (!runtimeState) {
    mountFieldNodeResources(node, nextDescriptor, context)

    return
  }

  if (previousDescriptor && previousDescriptor.name !== nextDescriptor.name) {
    resources.fieldIndex.unregister(node)
  }

  setFieldStaticSchema(runtimeState, nextDescriptor)
  updateRuntimeViewState(node, nextDescriptor, resources)
  resources.fieldIndex.register(node)
  recreateFieldEffects(node, nextDescriptor, runtimeState, context)
}

export function unmountFieldNodeResources<TValues extends Values>(
  node: FieldRuntimeNode<TValues>,
  context: SchemxContext<TValues>
): void {
  const resources = context.nodeResources

  resources.fieldIndex.unregister(node)
  node.effectDispose?.dispose()
  node.effectDispose = null
  node.fieldState = null
}

function recreateFieldEffects<TValues extends Values>(
  node: FieldRuntimeNode<TValues>,
  descriptor: FieldDescriptor<TValues>,
  runtimeState: FieldRuntimeState<TValues>,
  context: SchemxContext<TValues>
): void {
  node.effectDispose?.dispose()

  const effectDispose = node.dispose.child()
  node.effectDispose = effectDispose

  createValidationEffect({
    context,
    name: descriptor.name,
    effectiveSchema: runtimeState.effectiveSchema,
    scope: effectDispose,
  })
  createDependenciesEffect({
    context,
    descriptor,
    runtimeState,
    scope: effectDispose,
  })

  effectDispose.add(() => {
    if (node.effectDispose === effectDispose) {
      node.effectDispose = null
    }
  })
}

function applyFieldInitialValue<TValues extends Values>(
  descriptor: FieldDescriptor<TValues>,
  context: SchemxContext<TValues>
): void {
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
