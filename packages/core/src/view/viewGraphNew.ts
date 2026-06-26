/**
 * T035 [US1] - View Graph
 *
 * 实现 ViewGraph static projection，读取 SchemaGraph、
 * ValueGraph 和 EffectiveSchema。
 *
 * @module core/view/viewGraphNew
 */

import type { ViewComputed, RootViewComputed, ViewGraph } from "./viewGraphTypes"
import type { SchemxViewSchema } from "./types"
import type {
  NodeId,
  SchemaGraphStore,
  SchemaGraphSnapshot,
  SchemaNodeRecord,
} from "../schemaGraph/types"
import type { ValueGraph } from "../valueGraph/types"
import type { EffectiveSchemaLayer, EffectiveFieldSchema } from "../effectiveSchema/types"
import type { Values } from "../types/form"
import { ROOT_NODE_ID } from "../schemaGraph/types"
import { signal } from "@preact/signals-core"

/**
 * View Computed 实现。
 */
class ViewComputedImpl<TValues extends Values = Values>
  implements ViewComputed<TValues>
{
  private _value = signal<SchemxViewSchema<TValues> | readonly SchemxViewSchema<TValues>[] | null>(null)

  get value(): SchemxViewSchema<TValues> | readonly SchemxViewSchema<TValues>[] | null {
    return this._value.value
  }

  set value(v: SchemxViewSchema<TValues> | readonly SchemxViewSchema<TValues>[] | null) {
    this._value.value = v
  }

  updateValue(v: SchemxViewSchema<TValues> | readonly SchemxViewSchema<TValues>[] | null): void {
    this._value.value = v
  }
}

/**
 * Root View Computed 实现。
 */
class RootViewComputedImpl<TValues extends Values = Values>
  implements RootViewComputed<TValues>
{
  private _value = signal<readonly SchemxViewSchema<TValues>[]>([])

  get value(): readonly SchemxViewSchema<TValues>[] {
    return this._value.value
  }

  set value(v: readonly SchemxViewSchema<TValues>[]) {
    this._value.value = v
  }

  updateValue(v: readonly SchemxViewSchema<TValues>[]): void {
    this._value.value = v
  }
}

/**
 * View Graph 实现。
 */
export class ViewGraphImpl<TValues extends Values = Values>
  implements ViewGraph<TValues>
{
  private rootView = new RootViewComputedImpl<TValues>()
  private views: Map<NodeId, ViewComputedImpl<TValues>> = new Map()
  private subscribers: Set<
    (schemas: readonly SchemxViewSchema<TValues>[]) => void
  > = new Set()

  private schemaGraph: SchemaGraphStore<TValues> | null = null
  private valueGraph: ValueGraph<TValues> | null = null
  private effectiveSchema: EffectiveSchemaLayer<TValues> | null = null

  constructor() {}

  /**
   * 连接到其他 graph 层。
   */
  connect(
    schemaGraph: SchemaGraphStore<TValues>,
    valueGraph: ValueGraph<TValues>,
    effectiveSchema: EffectiveSchemaLayer<TValues>
  ): void {
    this.schemaGraph = schemaGraph
    this.valueGraph = valueGraph
    this.effectiveSchema = effectiveSchema
  }

  ensureView(nodeId: NodeId): ViewComputedImpl<TValues> {
    let view = this.views.get(nodeId)
    if (!view) {
      view = new ViewComputedImpl<TValues>()
      this.views.set(nodeId, view)
    }
    return view
  }

  getRootView(): RootViewComputed<TValues> {
    return this.rootView
  }

  getCurrentViewSchemas(): readonly SchemxViewSchema<TValues>[] {
    return this.rootView.value
  }

  /**
   * 重新计算视图投影。
   */
  recompute(): void {
    if (!this.schemaGraph) {
      this.rootView.updateValue([])
      this.notifySubscribers()
      return
    }

    const snapshot = this.schemaGraph.snapshot
    const rootChildren = snapshot.childrenById.get(ROOT_NODE_ID) || []

    const viewSchemas: SchemxViewSchema<TValues>[] = []

    for (const nodeId of rootChildren) {
      const viewSchema = this.computeNodeView(nodeId, snapshot)
      if (viewSchema) {
        viewSchemas.push(viewSchema)
      }
    }

    this.rootView.updateValue(viewSchemas)
    this.notifySubscribers()
  }

  /**
   * 计算单个节点的视图。
   */
  private computeNodeView(
    nodeId: NodeId,
    snapshot: SchemaGraphSnapshot<TValues>
  ): SchemxViewSchema<TValues> | null {
    const node = snapshot.nodesById.get(nodeId)
    if (!node) return null

    if (node.kind === "field") {
      return this.computeFieldView(nodeId, node)
    }

    if (node.kind === "group") {
      return this.computeGroupView(nodeId, node, snapshot)
    }

    // 动态 slot 在 US3 中处理
    return null
  }

  /**
   * 计算字段节点的视图。
   */
  private computeFieldView(
    nodeId: NodeId,
    node: SchemaNodeRecord<TValues>
  ): SchemxViewSchema<TValues> | null {
    const effective = this.effectiveSchema?.getField(nodeId)
    if (!effective) return null

    const effectiveValue: EffectiveFieldSchema<TValues> = effective.value

    // 获取字段值
    let fieldValue: unknown = undefined
    if (this.valueGraph && node.kind === "field") {
      const fieldNode = this.valueGraph.getFieldByName(
        node.name as keyof TValues
      )
      if (fieldNode) {
        fieldValue = fieldNode.value.value
      }
    }

    return {
      ...effectiveValue,
      key: nodeId,
      componentProps: {
        ...effectiveValue.componentProps,
        value: fieldValue,
      },
    } as unknown as SchemxViewSchema<TValues>
  }

  /**
   * 计算分组节点的视图。
   */
  private computeGroupView(
    nodeId: NodeId,
    node: SchemaNodeRecord<TValues>,
    snapshot: SchemaGraphSnapshot<TValues>
  ): SchemxViewSchema<TValues> | null {
    if (node.kind !== "group") return null

    const children = snapshot.childrenById.get(nodeId) || []
    const childViews: SchemxViewSchema<TValues>[] = []

    for (const childId of children) {
      const childView = this.computeNodeView(childId, snapshot)
      if (childView) {
        childViews.push(childView)
      }
    }

    return {
      ...node.staticSchema,
      key: nodeId,
      componentType: "group",
      children: childViews,
    } as unknown as SchemxViewSchema<TValues>
  }

  subscribe(callback: (schemas: readonly SchemxViewSchema<TValues>[]) => void): () => void {
    this.subscribers.add(callback)
    // 立即调用一次，提供当前值
    callback(this.rootView.value)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  disposeNode(nodeId: NodeId): void {
    this.views.delete(nodeId)
  }

  notifySubscribers(): void {
    const schemas = this.rootView.value
    for (const subscriber of this.subscribers) {
      try {
        subscriber(schemas)
      } catch (e) {
        console.warn("[schemx] Error in view subscriber:", e)
      }
    }
  }
}

/**
 * 创建 ViewGraph 实例。
 */
export function createViewGraph<
  TValues extends Values = Values
>(): ViewGraphImpl<TValues> {
  return new ViewGraphImpl<TValues>()
}
