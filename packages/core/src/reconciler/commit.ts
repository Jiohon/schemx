import type { DescribedRuntimeNode } from "../node"
import type { ContainerRuntimeNode } from "../node"
import type { Values } from "../types"
import type {
  CommitReconcilePlanOptions,
  ReconcilePlan,
} from "./types"

export function commitReconcilePlan<TValues extends Values = Values>(
  parent: ContainerRuntimeNode<TValues>,
  plan: ReconcilePlan<TValues>,
  options: CommitReconcilePlanOptions<TValues>
): readonly DescribedRuntimeNode<TValues>[] {
  const createdByKey = new Map<string, DescribedRuntimeNode<TValues>>()

  for (const { descriptor } of plan.creates) {
    const node = options.nodeManager.createNode({
      type: descriptor.type,
      key: descriptor.key,
      scope: parent.scope.child(),
    })

    createdByKey.set(descriptor.key, node)
  }

  const nextChildren = plan.nextChildrenOrder.map((entry) => {
    if (entry.node) {
      return entry.node
    }

    const created = createdByKey.get(entry.descriptor.key)

    if (!created) {
      throw new Error(
        `[schemx] Missing created runtime node for descriptor "${entry.descriptor.key}".`
      )
    }

    return created
  })

  for (const { node, previousDescriptor, nextDescriptor } of plan.updates) {
    options.lifecycle.update(node, previousDescriptor, nextDescriptor)
  }

  for (const { descriptor } of plan.creates) {
    const node = createdByKey.get(descriptor.key)

    if (!node) {
      throw new Error(
        `[schemx] Missing mounted runtime node for descriptor "${descriptor.key}".`
      )
    }

    options.lifecycle.mount(node, descriptor)
  }

  options.nodeManager.replaceChildren(parent, nextChildren)

  for (const { node } of plan.removes) {
    options.lifecycle.unmountSubtree(node)
    options.nodeManager.removeSubtree(node)
  }

  return nextChildren
}
