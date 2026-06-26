/**
 * Runtime Scope - 类型定义
 *
 * 定义生命周期范围、资源释放和 Runtime Scope Manager 所需的类型。
 *
 * @module core/runtimeScope/types
 */

import type { NodeId } from "../schemaGraph/types"

/**
 * Disposer - 资源释放函数。
 */
export type Disposer = () => void

/**
 * Runtime Scope - 单个节点的运行时范围。
 *
 * 持有该节点相关的所有 disposer 和 AbortController。
 */
export interface RuntimeScope {
  /** 节点 ID */
  readonly nodeId: NodeId
  /** 释放函数集合 */
  readonly disposers: Set<Disposer>
  /** AbortController（用于取消异步操作） */
  abortController?: AbortController
  /** 是否已释放 */
  readonly disposed: boolean

  /**
   * 添加一个释放函数。
   *
   * @param disposer - 释放函数
   */
  add(disposer: Disposer): void

  /**
   * 获取或创建 AbortController。
   *
   * @returns AbortController
   */
  getOrCreateAbortController(): AbortController

  /**
   * 中止当前异步操作（如果有）。
   */
  abort(): void

  /**
   * 释放该 scope 的所有资源。
   */
  dispose(): void
}

/**
 * Runtime Scope Manager - 生命周期管理器。
 *
 * 管理 form scope、node scope、effect disposer、subscription disposer 和 pending async work。
 * 递归释放 removed subtree。
 * 确保 disposed scope 的异步结果不能提交状态。
 */
export interface RuntimeScopeManager {
  /**
   * 确保节点 scope 存在并返回。
   *
   * @param nodeId - 节点 ID
   * @returns 节点 scope
   */
  ensureScope(nodeId: NodeId): RuntimeScope

  /**
   * 获取节点 scope（如果存在）。
   *
   * @param nodeId - 节点 ID
   * @returns 节点 scope
   */
  getScope(nodeId: NodeId): RuntimeScope | undefined

  /**
   * 检查节点是否已释放。
   *
   * @param nodeId - 节点 ID
   * @returns 是否已释放
   */
  isDisposed(nodeId: NodeId): boolean

  /**
   * 释放单个节点 scope。
   *
   * @param nodeId - 节点 ID
   */
  disposeScope(nodeId: NodeId): void

  /**
   * 释放子树（递归）。
   *
   * @param rootNodeId - 子树根节点 ID
   * @param getChildren - 获取子节点 ID 的函数
   */
  disposeSubtree(
    rootNodeId: NodeId,
    getChildren: (nodeId: NodeId) => readonly NodeId[]
  ): void

  /**
   * 释放整个表单。
   */
  disposeForm(): void
}
