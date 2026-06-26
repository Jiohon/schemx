/**
 * Validation - 类型定义
 *
 * 定义校验状态、校验引擎所需的类型。
 *
 * @module core/validation/types
 */

import type { NodeId } from "../schemaGraph/types"
import type { Values } from "../types"

/**
 * Validation State - 字段校验状态。
 */
export interface ValidationState {
  /** 错误列表 */
  readonly errors: readonly string[]
  /** 是否校验中 */
  readonly validating: boolean
  /** 当前运行 ID（用于 latest-wins） */
  readonly currentRunId?: number
  /** 最后完成的运行 ID */
  readonly lastCompletedRunId?: number
}

/**
 * Validation Result - 校验结果。
 */
export interface ValidationResult {
  /** 是否有效 */
  readonly valid: boolean
  /** 错误列表 */
  readonly errors: readonly string[]
}

/**
 * Validation Engine - 校验引擎。
 *
 * 基于 current effective schema 和 current field value 执行字段/表单校验。
 * 管理 async validation run id 和 stale drop。
 * 对 invisible field 执行 skip/clear 规则。
 */
export interface ValidationEngine<TValues extends Values = Values> {
  /**
   * Mount 字段节点（设置监听）。
   *
   * @param nodeId - 节点 ID
   * @param fieldName - 字段路径
   */
  mountField(nodeId: NodeId, fieldName: keyof TValues): void

  /**
   * 校验单个字段。
   *
   * @param nodeId - 节点 ID
   * @returns 校验结果 Promise
   */
  validateField(nodeId: NodeId): Promise<ValidationResult>

  /**
   * 校验整个表单。
   *
   * @returns 校验结果 Promise
   */
  validateForm(): Promise<ValidationResult>

  /**
   * 获取字段校验状态。
   *
   * @param nodeId - 节点 ID
   * @returns 校验状态（如果存在）
   */
  getState(nodeId: NodeId): ValidationState | undefined

  /**
   * 清除字段错误（用于 invisible 字段）。
   *
   * @param nodeId - 节点 ID
   */
  clearErrors(nodeId: NodeId): void

  /**
   * 释放节点。
   *
   * @param nodeId - 节点 ID
   */
  disposeNode(nodeId: NodeId): void
}
