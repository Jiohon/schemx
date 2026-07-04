import { createRuntimeLifecycle } from "../node/runtimeLifecycle"
import { createRuntimeNodeManager } from "../node/runtimeNodeManager"

import { commitReconcilePlan } from "./commit"
import { createReconcilePlan } from "./plan"

import type { FormDescriptor } from "../descriptor"
import type { CreateReconcilerContext, Reconciler } from "./types"
import type {
  ContainerRuntimeNode,
  DescribedRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
} from "../node/types"
import type { Values } from "../types"

export function createReconciler<TValues extends Values = Values>(
  context: CreateReconcilerContext<TValues>
): Reconciler<TValues> {
  const nodeManager = createRuntimeNodeManager<TValues>(context)
  const lifecycle = createRuntimeLifecycle<TValues>(context)

  // const runtime = normalizeReconcilerContext(context)

  function createRoot(): RootRuntimeNode<TValues> {
    const createRootNode = nodeManager.createRoot

    if (!createRootNode) {
      throw new Error("[schemx] Reconciler nodeManager cannot create root node.")
    }

    return createRootNode()
  }

  function updateNode(
    node: DescribedRuntimeNode<TValues>,
    nextDescriptor: FormDescriptor<TValues>
  ): void {
    const previousDescriptor = node.descriptor

    if (previousDescriptor === nextDescriptor) {
      return
    }

    lifecycle.update(node, previousDescriptor, nextDescriptor)
  }

  function removeNode(node: RuntimeNode<TValues>): void {
    lifecycle.unmountSubtree(node)
    nodeManager.removeSubtree(node)
  }

  function reconcileChildren(
    parent: ContainerRuntimeNode<TValues>,
    nextDescriptors: readonly FormDescriptor<TValues>[]
  ): void {
    const currentChildren = parent.childNodes.value

    const plan = createReconcilePlan(currentChildren, nextDescriptors)

    const orderedNodes = commitReconcilePlan(parent, plan, { nodeManager, lifecycle })

    for (const [index, node] of orderedNodes.entries()) {
      const descriptor = nextDescriptors[index]

      if (descriptor?.type === "group" && node.type === "group") {
        reconcileChildren(node, descriptor.children)
      }
    }
  }

  return {
    createRoot,
    reconcileChildren,
    updateNode,
    removeNode,
  }
}
