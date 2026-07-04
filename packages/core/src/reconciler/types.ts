import type { FormDescriptor } from "../descriptor"
import type {
  ContainerRuntimeNode,
  DescribedRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
  RuntimeNodeManager,
} from "../node"
import type { RuntimeLifecycle } from "../node/runtimeLifecycle"
import type { SchemxContext } from "../schemxContext"
import type { Values } from "../types"

export interface ReconcileCreateOperation<TValues extends Values = Values> {
  readonly descriptor: FormDescriptor<TValues>
}

export interface ReconcileUpdateOperation<TValues extends Values = Values> {
  readonly node: DescribedRuntimeNode<TValues>
  readonly previousDescriptor: FormDescriptor<TValues> | null
  readonly nextDescriptor: FormDescriptor<TValues>
}

export interface ReconcileRemoveOperation<TValues extends Values = Values> {
  readonly node: DescribedRuntimeNode<TValues>
}

export interface ReconcileChildOrderEntry<TValues extends Values = Values> {
  readonly descriptor: FormDescriptor<TValues>
  readonly node?: DescribedRuntimeNode<TValues>
}

export interface ReconcilePlan<TValues extends Values = Values> {
  readonly creates: readonly ReconcileCreateOperation<TValues>[]
  readonly updates: readonly ReconcileUpdateOperation<TValues>[]
  readonly removes: readonly ReconcileRemoveOperation<TValues>[]
  readonly nextChildrenOrder: readonly ReconcileChildOrderEntry<TValues>[]
}

export type ReconcileNodeManager<TValues extends Values = Values> = Pick<
  RuntimeNodeManager<TValues>,
  "createNode" | "replaceChildren" | "removeSubtree"
>

export interface CommitReconcilePlanOptions<TValues extends Values = Values> {
  readonly nodeManager: ReconcileNodeManager<TValues>
  readonly lifecycle: RuntimeLifecycle<TValues>
}

export interface Reconciler<TValues extends Values = Values> {
  createRoot(): RootRuntimeNode<TValues>
  reconcileChildren(
    parent: ContainerRuntimeNode<TValues>,
    nextDescriptors: readonly FormDescriptor<TValues>[]
  ): void
  updateNode(
    node: DescribedRuntimeNode<TValues>,
    nextDescriptor: FormDescriptor<TValues>
  ): void
  removeNode(node: RuntimeNode<TValues>): void
}

export type CreateReconcilerContext<TValues extends Values = Values> =
  SchemxContext<TValues>
