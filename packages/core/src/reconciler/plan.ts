import type { FormDescriptor } from "../descriptor"
import type { DescribedRuntimeNode } from "../node"
import type { Values } from "../types"
import type {
  ReconcileChildOrderEntry,
  ReconcileCreateOperation,
  ReconcilePlan,
  ReconcileRemoveOperation,
  ReconcileUpdateOperation,
} from "./types"

export function createReconcilePlan<TValues extends Values = Values>(
  currentChildren: readonly DescribedRuntimeNode<TValues>[],
  nextDescriptors: readonly FormDescriptor<TValues>[]
): ReconcilePlan<TValues> {
  const currentByKey = indexNodesByKey(currentChildren)
  const nextByKey = indexDescriptorsByKey(nextDescriptors)
  const creates: ReconcileCreateOperation<TValues>[] = []
  const updates: ReconcileUpdateOperation<TValues>[] = []
  const removes: ReconcileRemoveOperation<TValues>[] = []
  const nextChildrenOrder: ReconcileChildOrderEntry<TValues>[] = []

  for (const descriptor of nextDescriptors) {
    const existing = currentByKey.get(descriptor.key)

    if (!existing || !canReuse(existing, descriptor)) {
      creates.push({ descriptor })
      nextChildrenOrder.push({ descriptor })
      continue
    }

    const previousDescriptor = existing.descriptor

    if (previousDescriptor !== descriptor) {
      updates.push({
        node: existing,
        previousDescriptor,
        nextDescriptor: descriptor,
      })
    }

    nextChildrenOrder.push({ descriptor, node: existing })
  }

  for (const child of currentChildren) {
    const nextDescriptor = nextByKey.get(child.key)

    if (!nextDescriptor || !canReuse(child, nextDescriptor)) {
      removes.push({ node: child })
    }
  }

  return {
    creates,
    updates,
    removes,
    nextChildrenOrder,
  }
}

function canReuse<TValues extends Values>(
  node: DescribedRuntimeNode<TValues>,
  descriptor: FormDescriptor<TValues>
): boolean {
  return node.type === descriptor.type
}

function indexNodesByKey<TValues extends Values>(
  nodes: readonly DescribedRuntimeNode<TValues>[]
): Map<string, DescribedRuntimeNode<TValues>> {
  const result = new Map<string, DescribedRuntimeNode<TValues>>()

  for (const node of nodes) {
    result.set(node.key, node)
  }

  return result
}

function indexDescriptorsByKey<TValues extends Values>(
  descriptors: readonly FormDescriptor<TValues>[]
): Map<string, FormDescriptor<TValues>> {
  const result = new Map<string, FormDescriptor<TValues>>()

  for (const descriptor of descriptors) {
    result.set(descriptor.key, descriptor)
  }

  return result
}
