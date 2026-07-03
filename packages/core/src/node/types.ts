import type { FormDescriptor } from "../descriptor"
import type { DependencyEffectState } from "../field/dependencyEffect"
import type { FieldRuntimeState } from "../field/runtimeState"
import type { Signal } from "../reactivity"
import type { NamePath, Values } from "../types"
import type { RuntimeViewState } from "../view/viewGraph"

/**
 * RuntimeDispose 执行的清理函数。
 */
export type RuntimeCleanup = () => void

/**
 * cleanup 注册后的释放句柄。
 */
export interface RuntimeCleanupHandle {
  readonly disposed: boolean
  dispose(): void
}

/**
 * Runtime 资源生命周期边界。
 */
export interface RuntimeDispose {
  readonly disposed: boolean
  add(cleanup: RuntimeCleanup): RuntimeCleanupHandle
  child(): RuntimeDispose
  dispose(): void
}

export type ScopeCleanup = RuntimeCleanup
export type ScopeCleanupHandle = RuntimeCleanupHandle
export type Scope = RuntimeDispose

export interface ScopeCleanupRecord {
  cleanup: ScopeCleanup
  disposed: boolean
}

/**
 * Runtime node 支持的节点类型。
 */
export type RuntimeNodeType = "root" | "field" | "group" | "dependency"

/**
 * RuntimeNode 内部稳定 id。
 */
export type RuntimeNodeId = number

/**
 * 所有 RuntimeNode 共享的结构字段。
 */
interface BaseRuntimeNode<TValues extends Values = Values> {
  /**
   * RuntimeNode 内部稳定 id。
   */
  readonly id: RuntimeNodeId

  /**
   * 用于 keyed reconcile 的稳定 key。
   */
  readonly key: string

  /**
   * 节点类型。
   */
  readonly type: RuntimeNodeType

  /**
   * 父 RuntimeNode。
   *
   * root 节点没有 parent。
   */
  parent: RuntimeNode<TValues> | null

  /**
   * RuntimeNode 自身的完整生命周期边界。
   *
   * 当 node 被 reconcile 移除时，应 dispose 当前 scope。
   */
  scope: Scope

  /**
   * 领域资源是否已经完成挂载。
   */
  mounted: Signal<boolean>

  /**
   * 节点是否已经进入销毁流程。
   */
  disposed: Signal<boolean>
}

/**
 * RootRuntimeNode - 透明根节点。
 *
 * Root 不对应任何 schema，只负责承载顶层 children。
 */
export interface RootRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  readonly type: "root"

  parent: null

  /**
   * 顶层 runtime 子节点。
   */
  childNodes: DescribedRuntimeNode<TValues>[]
}

/**
 * FieldRuntimeNode - 字段节点。
 *
 * Field 不承载结构子节点。
 * 字段 descriptor、runtimeState、viewState、校验资源等都由 RuntimeNodeResources 承载。
 */
export interface FieldRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  readonly type: "field"

  parent: ContainerRuntimeNode<TValues> | null
}

/**
 * GroupRuntimeNode - 分组节点。
 *
 * Group 负责结构嵌套。
 */
export interface GroupRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  readonly type: "group"

  parent: ContainerRuntimeNode<TValues> | null

  /**
   * 静态 schema children 编译后的 runtime 子节点。
   */
  childNodes: DescribedRuntimeNode<TValues>[]
}

/**
 * DependencyRuntimeNode - 动态 dependency 节点。
 *
 * Dependency 的 children 来自 renderer 动态产物。
 */
export interface DependencyRuntimeNode<
  TValues extends Values = Values,
> extends BaseRuntimeNode<TValues> {
  readonly type: "dependency"

  parent: ContainerRuntimeNode<TValues> | null

  /**
   * dependency renderer 产出的动态 runtime 子节点。
   */
  childNodes: DescribedRuntimeNode<TValues>[]
}

/**
 * 所有 RuntimeNode。
 */
export type RuntimeNode<TValues extends Values = Values> =
  | RootRuntimeNode<TValues>
  | FieldRuntimeNode<TValues>
  | GroupRuntimeNode<TValues>
  | DependencyRuntimeNode<TValues>

/**
 * 除 root 外，所有带 descriptor 的 RuntimeNode。
 */
export type DescribedRuntimeNode<TValues extends Values = Values> =
  | FieldRuntimeNode<TValues>
  | GroupRuntimeNode<TValues>
  | DependencyRuntimeNode<TValues>

/**
 * 可以承载子节点的 RuntimeNode。
 */
export type ContainerRuntimeNode<TValues extends Values = Values> =
  | RootRuntimeNode<TValues>
  | GroupRuntimeNode<TValues>
  | DependencyRuntimeNode<TValues>

/**
 * 容器 children 响应式状态。
 */
export interface RuntimeChildrenState<TValues extends Values = Values> {
  readonly children: Signal<readonly DescribedRuntimeNode<TValues>[]>
}

export interface RuntimeFieldIndex<TValues extends Values = Values> {
  register(node: FieldRuntimeNode<TValues>): void
  unregister(node: FieldRuntimeNode<TValues>): void
  getByName(name: NamePath<TValues>): FieldRuntimeNode<TValues> | undefined
  getByPath(path: NamePath<TValues>): FieldRuntimeNode<TValues> | undefined
}

export interface RuntimeDependencyIndex<TValues extends Values = Values> {
  register(node: DependencyRuntimeNode<TValues>): void
  unregister(node: DependencyRuntimeNode<TValues>): void
  getByTriggerField(name: NamePath<TValues>): readonly DependencyRuntimeNode<TValues>[]
  getTriggerFields(node: DependencyRuntimeNode<TValues>): readonly NamePath<TValues>[]
}

/**
 * RuntimeNode 之外的领域资源注册表。
 */
export interface RuntimeNodeResourceContext<TValues extends Values = Values> {
  readonly nodes: Map<RuntimeNodeId, RuntimeNode<TValues>>
  readonly fieldIndex: RuntimeFieldIndex<TValues>
  readonly dependencyIndex: RuntimeDependencyIndex<TValues>
  readonly descriptors: Map<RuntimeNodeId, FormDescriptor<TValues>>
  readonly fieldStates: Map<RuntimeNodeId, FieldRuntimeState<TValues>>
  readonly viewStates: Map<RuntimeNodeId, RuntimeViewState<TValues>>
  readonly childrenStates: Map<RuntimeNodeId, RuntimeChildrenState<TValues>>
  readonly dependencyEffects: Map<RuntimeNodeId, DependencyEffectState>
  readonly fieldResourceScopes: Map<RuntimeNodeId, Scope>
  readonly fieldDynamicPropScopes: Map<RuntimeNodeId, Scope>
  readonly dependencyResourceScopes: Map<RuntimeNodeId, Scope>
}

export type RuntimeNodeResourceMaps<TValues extends Values = Values> = {
  [K in keyof RuntimeNodeResourceContext<TValues>]: RuntimeNodeResourceContext<TValues>[K]
}

export interface CreateRootRuntimeNodeOptions {
  scope: Scope
}

export interface CreateFieldRuntimeNodeOptions<TValues extends Values = Values> {
  id: RuntimeNodeId
  key: string
  parent?: ContainerRuntimeNode<TValues> | null
  scope?: Scope
}

export interface CreateGroupRuntimeNodeOptions<TValues extends Values = Values> {
  id: RuntimeNodeId
  key: string
  parent?: ContainerRuntimeNode<TValues> | null
  scope?: Scope
}

export interface CreateDependencyRuntimeNodeOptions<TValues extends Values = Values> {
  id: RuntimeNodeId
  key: string
  parent?: ContainerRuntimeNode<TValues> | null
  scope?: Scope
}

export interface CreateRuntimeNodeOptions {
  type: Exclude<RuntimeNodeType, "root">
  key: string
  scope?: Scope
}

export interface CreateRuntimeNodeManagerOptions<TValues extends Values = Values> {
  resources?: RuntimeNodeResourceContext<TValues>
}

export interface RuntimeNodeManager<TValues extends Values = Values> {
  readonly resources: RuntimeNodeResourceContext<TValues>
  readonly nodes: Map<RuntimeNodeId, RuntimeNode<TValues>>
  createRoot(): RootRuntimeNode<TValues>
  create(
    descriptor: FormDescriptor<TValues>,
    parent: ContainerRuntimeNode<TValues>
  ): DescribedRuntimeNode<TValues>
  createNode(options: CreateRuntimeNodeOptions): DescribedRuntimeNode<TValues>
  getNode(nodeId: RuntimeNodeId): RuntimeNode<TValues> | undefined
  traverse(root: RuntimeNode<TValues>): RuntimeNode<TValues>[]
  insertChild(
    parent: ContainerRuntimeNode<TValues>,
    child: DescribedRuntimeNode<TValues>,
    index?: number
  ): void
  replaceChildren(
    parent: ContainerRuntimeNode<TValues>,
    children: readonly DescribedRuntimeNode<TValues>[]
  ): void
  removeChild(
    parent: ContainerRuntimeNode<TValues>,
    child: DescribedRuntimeNode<TValues>
  ): void
  removeSubtree(node: RuntimeNode<TValues>): void
}
