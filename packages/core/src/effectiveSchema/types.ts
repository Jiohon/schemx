/**
 * Effective Schema - 类型定义
 *
 * 定义有效 schema 合并和 Effective Schema Layer 所需的类型。
 *
 * @module core/effectiveSchema/types
 */

import type { NodeId } from "../schemaGraph/types"
import type { DynamicOverrides } from "../dynamicProps/types"
import type { SchemxResolvedBaseField } from "../types/schema"
import type { Values } from "../types/form"

/**
 * Effective Field Schema - 有效字段 schema。
 *
 * 合并了静态 schema、表单默认配置和动态覆盖后的最终 schema。
 */
export type EffectiveFieldSchema<TValues extends Values = Values> =
  SchemxResolvedBaseField<TValues> &
    DynamicOverrides & {
      /** 版本号（任何来源变化时递增） */
      readonly revision: number
    }

/**
 * Effective Schema Layer - 有效 schema 层。
 *
 * 按确定优先级合并 defaults、static schema、dynamic overrides。
 * 作为 validation 和 view graph 的共同事实来源。
 */
export interface EffectiveSchemaLayer<TValues extends Values = Values> {
  /**
   * 确保字段的有效 schema 存在并返回。
   *
   * @param nodeId - 节点 ID
   * @param staticSchema - 静态 schema
   * @returns 有效 schema（computed）
   */
  ensureField(
    nodeId: NodeId,
    staticSchema: SchemxResolvedBaseField<TValues>
  ): EffectiveFieldComputed<TValues>

  /**
   * 获取字段的有效 schema（如果已存在）。
   *
   * @param nodeId - 节点 ID
   * @returns 有效 schema（computed）
   */
  getField(nodeId: NodeId): EffectiveFieldComputed<TValues> | undefined

  /**
   * 更新表单默认配置。
   *
   * @param defaults - 默认配置
   */
  setDefaults(defaults: Record<string, unknown>): void

  /**
   * 释放节点。
   *
   * @param nodeId - 节点 ID
   */
  disposeNode(nodeId: NodeId): void
}

/**
 * Effective Field Computed - 有效字段的 computed 包装。
 */
export interface EffectiveFieldComputed<TValues extends Values = Values> {
  /** 当前有效 schema 值 */
  readonly value: EffectiveFieldSchema<TValues>
}
