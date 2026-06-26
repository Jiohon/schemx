/**
 * Dynamic Props - 类型定义
 *
 * 定义动态属性覆盖、Override Store 和 Dynamic Props Engine 所需的类型。
 *
 * @module core/dynamicProps/types
 */

import type { NodeId } from "../schemaGraph/types"
import type { Values } from "../types/form"

/**
 * Dynamic Overrides - 动态属性覆盖。
 *
 * 由字段 dependencies 计算而来，会与静态 schema 合并生成 effective schema。
 */
export interface DynamicOverrides {
  /** 可见性覆盖 */
  readonly visible?: boolean
  /** 禁用态覆盖 */
  readonly disabled?: boolean
  /** 必填态覆盖 */
  readonly required?: boolean
  /** 校验规则覆盖 */
  readonly rules?: unknown
  /** 组件属性覆盖 */
  readonly componentProps?: Record<string, unknown>
  /** 占位符覆盖 */
  readonly placeholder?: string
}

/**
 * Override Record - Override Store 中存储的覆盖记录。
 */
export interface OverrideRecord {
  /** 动态覆盖值 */
  readonly overrides: DynamicOverrides
  /** 触发字段（用于依赖追踪） */
  readonly triggerFields?: readonly string[]
  /** 被覆盖的键列表 */
  readonly overriddenKeys: readonly string[]
  /** 版本号（每次变化时递增） */
  readonly revision: number
  /** 最后更新来源 */
  readonly lastUpdatedBy?: string
  /** 错误信息（如果计算失败） */
  readonly error?: Error
}

/**
 * Override Store - 动态属性覆盖存储。
 *
 * 按 nodeId 存储 dynamic overrides、trigger fields、version 和 diagnostics。
 */
export interface OverrideStore {
  /**
   * 设置节点的覆盖。
   *
   * @param nodeId - 节点 ID
   * @param record - 覆盖记录
   */
  set(nodeId: NodeId, record: OverrideRecord): void

  /**
   * 获取节点的覆盖。
   *
   * @param nodeId - 节点 ID
   * @returns 覆盖记录（如果存在）
   */
  get(nodeId: NodeId): OverrideRecord | undefined

  /**
   * 检查节点是否有覆盖。
   *
   * @param nodeId - 节点 ID
   * @returns 是否有覆盖
   */
  has(nodeId: NodeId): boolean

  /**
   * 删除节点的覆盖。
   *
   * @param nodeId - 节点 ID
   */
  delete(nodeId: NodeId): void

  /**
   * 获取所有有覆盖的节点 ID。
   *
   * @returns 节点 ID 列表
   */
  allNodeIds(): readonly NodeId[]
}

/**
 * Dynamic Props Engine - 动态属性引擎。
 *
 * 执行字段级 dependencies，只生成 dynamic overrides，不修改 schema 结构。
 */
export interface DynamicPropsEngine<TValues extends Values = Values> {
  /**
   * Mount 字段节点（设置监听）。
   *
   * @param nodeId - 节点 ID
   * @param dependencies - 字段依赖配置
   */
  mountField(
    nodeId: NodeId,
    dependencies: unknown
  ): void

  /**
   * 获取节点的动态覆盖。
   *
   * @param nodeId - 节点 ID
   * @returns 动态覆盖
   */
  getOverrides(nodeId: NodeId): DynamicOverrides

  /**
   * 获取 Override Store（内部使用）。
   */
  readonly overrideStore: OverrideStore

  /**
   * 释放节点。
   *
   * @param nodeId - 节点 ID
   */
  disposeNode(nodeId: NodeId): void
}
