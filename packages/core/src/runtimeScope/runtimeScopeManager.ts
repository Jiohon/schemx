/**
 * Runtime Scope Manager - 生命周期管理器
 *
 * @module core/runtimeScope/runtimeScopeManager
 */

import type { RuntimeScope, RuntimeScopeManager, Disposer } from "./types"
import type { NodeId } from "../schemaGraph/types"

/**
 * Runtime Scope 实现。
 */
class RuntimeScopeImpl implements RuntimeScope {
  readonly nodeId: NodeId
  readonly disposers: Set<Disposer> = new Set()
  abortController?: AbortController
  disposed = false

  constructor(nodeId: NodeId) {
    this.nodeId = nodeId
  }

  add(disposer: Disposer): void {
    if (this.disposed) {
      // 已释放，立即调用 disposer
      disposer()
      return
    }
    this.disposers.add(disposer)
  }

  getOrCreateAbortController(): AbortController {
    if (this.disposed) {
      // 已释放，返回已中止的 controller
      const controller = new AbortController()
      controller.abort()
      return controller
    }
    if (!this.abortController) {
      this.abortController = new AbortController()
    }
    return this.abortController
  }

  abort(): void {
    if (this.abortController && !this.abortController.signal.aborted) {
      this.abortController.abort()
    }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.abort()
    for (const disposer of this.disposers) {
      try {
        disposer()
      } catch (e) {
        console.warn(`[schemx] Error disposing scope ${this.nodeId}:`, e)
      }
    }
    this.disposers.clear()
  }
}

/**
 * Runtime Scope Manager 实现。
 */
export class RuntimeScopeManagerImpl implements RuntimeScopeManager {
  private scopes: Map<NodeId, RuntimeScopeImpl> = new Map()
  private formDisposed = false

  /**
   * 确保节点 scope 存在并返回。
   */
  ensureScope(nodeId: NodeId): RuntimeScope {
    if (this.formDisposed) {
      // 表单已释放，返回已释放的 scope
      const scope = new RuntimeScopeImpl(nodeId)
      scope.dispose()
      return scope
    }
    let scope = this.scopes.get(nodeId)
    if (!scope) {
      scope = new RuntimeScopeImpl(nodeId)
      this.scopes.set(nodeId, scope)
    }
    return scope
  }

  /**
   * 获取节点 scope（如果存在）。
   */
  getScope(nodeId: NodeId): RuntimeScope | undefined {
    return this.scopes.get(nodeId)
  }

  /**
   * 检查节点是否已释放。
   */
  isDisposed(nodeId: NodeId): boolean {
    if (this.formDisposed) {
      return true
    }
    const scope = this.scopes.get(nodeId)
    return scope ? scope.disposed : false
  }

  /**
   * 释放单个节点 scope。
   */
  disposeScope(nodeId: NodeId): void {
    const scope = this.scopes.get(nodeId)
    if (scope) {
      scope.dispose()
      this.scopes.delete(nodeId)
    }
  }

  /**
   * 释放子树（递归）。
   */
  disposeSubtree(
    rootNodeId: NodeId,
    getChildren: (nodeId: NodeId) => readonly NodeId[]
  ): void {
    // 后序遍历：先释放子节点，再释放父节点
    const children = getChildren(rootNodeId)
    for (const childId of children) {
      this.disposeSubtree(childId, getChildren)
    }
    this.disposeScope(rootNodeId)
  }

  /**
   * 释放整个表单。
   */
  disposeForm(): void {
    if (this.formDisposed) {
      return
    }
    this.formDisposed = true
    // 释放所有 scope
    for (const scope of this.scopes.values()) {
      scope.dispose()
    }
    this.scopes.clear()
  }
}

/**
 * 创建 RuntimeScopeManager 实例。
 */
export function createRuntimeScopeManager(): RuntimeScopeManager {
  return new RuntimeScopeManagerImpl()
}
