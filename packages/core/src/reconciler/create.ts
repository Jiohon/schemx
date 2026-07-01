import { getChildRuntimeNodes } from "../node/runtimeNode"
import { createRuntimeLifecycle } from "../node/runtimeLifecycle"
import { createRuntimeNodeManager } from "../node/runtimeNodeManager"

import { commitReconcilePlan } from "./commit"
import { createReconcilePlan } from "./plan"

import type { FormDescriptor } from "../descriptor"
import type {
  ContainerRuntimeNode,
  DescribedRuntimeNode,
  RuntimeNode,
} from "../node/types"
import type { Values } from "../types"
import type {
  CreateReconcilerContext,
  ReconcileNodeManager,
  Reconciler,
  ReconcilerContext,
} from "./types"

export function createReconciler<TValues extends Values = Values>(
  context: CreateReconcilerContext<TValues>
): Reconciler<TValues> {
  const runtime = normalizeReconcilerContext(context)

  function reconcileChildren(
    parent: ContainerRuntimeNode<TValues>,
    nextDescriptors: readonly FormDescriptor<TValues>[]
  ): void {
    const currentChildren = getChildRuntimeNodes(parent)
    const plan = createReconcilePlan(
      currentChildren,
      nextDescriptors,
      runtime.getCurrentDescriptors()
    )
    const orderedNodes = commitReconcilePlan(parent, plan, runtime)

    for (const [index, node] of orderedNodes.entries()) {
      const descriptor = nextDescriptors[index]

      if (descriptor?.type === "group" && node.type === "group") {
        reconcileChildren(node, descriptor.children)
      }
    }
  }

  function createRoot() {
    const createRootNode = runtime.nodeManager.createRoot

    if (!createRootNode) {
      throw new Error("[schemx] Reconciler nodeManager cannot create root node.")
    }

    return createRootNode()
  }

  function updateNode(
    node: DescribedRuntimeNode<TValues>,
    nextDescriptor: FormDescriptor<TValues>
  ): void {
    const previousDescriptor = runtime.getCurrentDescriptors().get(node.id)

    if (previousDescriptor === nextDescriptor) {
      return
    }

    runtime.lifecycle.update(node, previousDescriptor, nextDescriptor)
  }

  function removeNode(node: RuntimeNode<TValues>): void {
    runtime.lifecycle.unmountSubtree(node)
    runtime.nodeManager.removeSubtree(node)
  }

  return {
    createRoot,
    reconcileChildren,
    updateNode,
    removeNode,
  }
}

type NormalizedReconcilerContext<TValues extends Values> =
  ReconcilerContext<TValues> & {
    readonly nodeManager: ReconcileNodeManager<TValues> & {
      createRoot?: () => ReturnType<Reconciler<TValues>["createRoot"]>
    }
  }

function normalizeReconcilerContext<TValues extends Values>(
  context: CreateReconcilerContext<TValues>
): NormalizedReconcilerContext<TValues> {
  if (isReconcilerContext(context)) {
    return context as NormalizedReconcilerContext<TValues>
  }

  const nodeManager = createRuntimeNodeManager<TValues>(context)
  const lifecycle = createRuntimeLifecycle<TValues>(context)

  return {
    nodeManager,
    lifecycle,
    getCurrentDescriptors: () => context.nodeResources.descriptors,
  }
}

function isReconcilerContext<TValues extends Values>(
  context: CreateReconcilerContext<TValues>
): context is ReconcilerContext<TValues> {
  return "nodeManager" in context && "lifecycle" in context
}
