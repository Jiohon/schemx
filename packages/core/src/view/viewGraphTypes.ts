/**
 * View Graph - 类型定义（补充）
 *
 * 定义 ViewGraph 所需的类型。
 *
 * @module core/view/viewGraphTypes
 */

import type { NodeId } from "../schemaGraph/types"
import type { Values } from "../types/form"
import type { SchemxViewSchema } from "./types"

/**
 * View Graph - 视图投影层。
 *
 * 只读投影 SchemaGraph、ValueGraph、EffectiveSchema、Validation 和 DynamicSlot children。
 * 输出 viewSchemas，隐藏 invisible field，透明展开 dynamic slot children。
 * 保留无关子树引用，提供 limited recomputation diagnostics。
 */
export interface ViewGraph<TValues extends Values = Values> {
  /**
   * 确保节点的视图存在并返回。
   *
   * @param nodeId - 节点 ID
   * @returns 视图 computed
   */
  ensureView(nodeId: NodeId): ViewComputed<TValues>

  /**
   * 获取 root 的视图（顶层 viewSchemas）。
   *
   * @returns root 视图 computed
   */
  getRootView(): RootViewComputed<TValues>

  /**
   * 获取当前 viewSchemas（同步读取）。
   *
   * @returns 当前 viewSchemas
   */
  getCurrentViewSchemas(): readonly SchemxViewSchema<TValues>[]

  /**
   * 释放节点。
   *
   * @param nodeId - 节点 ID
   */
  disposeNode(nodeId: NodeId): void

  /**
   * 订阅 viewSchemas 变化。
   *
   * @param callback - viewSchemas 变化时的回调
   * @returns 取消订阅函数
   */
  subscribe(callback: (schemas: readonly SchemxViewSchema<TValues>[]) => void): () => void
}

/**
 * View Computed - 单个节点的视图 computed。
 */
export interface ViewComputed<TValues extends Values = Values> {
  /** 当前视图值 */
  readonly value: SchemxViewSchema<TValues> | readonly SchemxViewSchema<TValues>[] | null
}

/**
 * Root View Computed - 根节点的视图 computed。
 */
export interface RootViewComputed<TValues extends Values = Values> {
  /** 当前顶层 viewSchemas */
  readonly value: readonly SchemxViewSchema<TValues>[]
}
