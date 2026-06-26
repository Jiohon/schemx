/**
 * Dynamic Slot - 类型定义
 *
 * 定义动态子树槽位、Slot Children 和 Dynamic Slot Engine 所需的类型。
 *
 * @module core/dynamicSlot/types
 */

import type { NodeId } from "../schemaGraph/types"
import type { SchemxSchemasInput as SchemxJsonSchemas } from "../createSchemas"
import type { Values } from "../types/form"

/**
 * Slot State - Dynamic Slot 的运行状态。
 */
export interface SlotState {
  /** 当前运行 ID */
  readonly currentRunId: number
  /** 是否有正在进行的异步运行 */
  readonly isRunning: boolean
  /** 最后完成的运行 ID */
  readonly lastCompletedRunId?: number
  /** AbortController（用于取消当前运行） */
  readonly abortController?: AbortController
}

/**
 * Slot Children Result - Slot Children 编译结果。
 */
export interface SlotChildrenResult<TValues extends Values = Values> {
  /** 编译后的规范化节点 */
  readonly normalizedNodes: unknown[]
  /** 编译错误（如果有） */
  readonly errors: readonly unknown[]
}

/**
 * Dynamic Slot Engine - 动态子树引擎。
 *
 * 执行 dynamic slot renderer，使用 run id 和 abort 实现 latest-wins，
 * 把 children 作为局部 schema input 提交给 Schema Graph Store。
 */
export interface DynamicSlotEngine<TValues extends Values = Values> {
  /**
   * Mount 槽位节点（设置监听）。
   *
   * @param nodeId - 槽位节点 ID
   * @param to - 依赖的字段路径
   * @param renderer - 动态子树渲染器
   */
  mountSlot(
    nodeId: NodeId,
    to: readonly (keyof TValues)[],
    renderer: unknown
  ): void

  /**
   * 手动刷新槽位（可用于外部触发）。
   *
   * @param nodeId - 槽位节点 ID
   */
  refreshSlot(nodeId: NodeId): Promise<void>

  /**
   * 获取槽位状态（用于诊断）。
   *
   * @param nodeId - 槽位节点 ID
   * @returns 槽位状态（如果存在）
   */
  getSlotState(nodeId: NodeId): SlotState | undefined

  /**
   * 释放槽位节点。
   *
   * @param nodeId - 槽位节点 ID
   */
  disposeNode(nodeId: NodeId): void
}
