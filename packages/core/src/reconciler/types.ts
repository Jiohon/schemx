import type { FormDescriptor } from "../descriptor"
import type {
  ContainerRuntimeNode,
  DescribedRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
  RuntimeNodeId,
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
  readonly previousDescriptor: FormDescriptor<TValues> | undefined
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

export type ReconcileDescriptorMap<TValues extends Values = Values> = ReadonlyMap<
  RuntimeNodeId,
  FormDescriptor<TValues>
>

export type ReconcileNodeManager<TValues extends Values = Values> = Pick<
  RuntimeNodeManager<TValues>,
  "createNode" | "replaceChildren" | "removeSubtree"
>

export type ReconcileLifecycle<TValues extends Values = Values> =
  RuntimeLifecycle<TValues>

export interface CommitReconcilePlanOptions<TValues extends Values = Values> {
  readonly nodeManager: ReconcileNodeManager<TValues>
  readonly lifecycle: ReconcileLifecycle<TValues>
}

export interface CommitReconcilePlanResult<TValues extends Values = Values> {
  readonly children: readonly DescribedRuntimeNode<TValues>[]
}

export interface CommitReconcilePlanInput<TValues extends Values = Values> {
  readonly parent: ContainerRuntimeNode<TValues>
  readonly plan: ReconcilePlan<TValues>
  readonly options: CommitReconcilePlanOptions<TValues>
}

export interface ReconcilerContext<TValues extends Values = Values>
  extends CommitReconcilePlanOptions<TValues> {
  getCurrentDescriptors(): ReconcileDescriptorMap<TValues>
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
  | SchemxContext<TValues>
  | ReconcilerContext<TValues>
