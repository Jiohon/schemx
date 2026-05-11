/**
 * Dependency 脏队列调度器。
 *
 * dependency 节点的 renderer 刷新会被合并到 microtask 中，并按 runtime key 去重，
 * 避免同一轮字段值高频变化触发多次 subtree 编译。
 *
 * @module core/scheduler/dependencyScheduler
 */

import { createRuntimeScheduler, type RuntimeScheduler } from "./runtimeScheduler"

import type { DependencyRuntimeNode } from "../runtime/types"
import type { Values } from "../types"

/**
 * Runtime dependency 调度器。
 *
 * @typeParam T - 表单值类型
 */
export class DependencyScheduler<T extends Values = Values> {
  constructor(
    private readonly scheduler: RuntimeScheduler = createRuntimeScheduler()
  ) {}

  /**
   * 标记 dependency 节点为 dirty，并调度刷新。
   */
  enqueueDependency(node: DependencyRuntimeNode<T>): void {
    if (node.disposed.value) return

    node.dirty = true
    this.scheduler.enqueue({
      type: "dependency",
      phase: "main",
      dedupeKey: node.key,
      run: () => {
        node.dirty = false
        node.dependencyRuntime.run().catch((error: unknown) => {
          // run 内部会处理正常错误路径；这里兜住调度层未预期异常，避免队列静默失败。
          node.dependencyRuntime.error.value =
            error instanceof Error ? error : new Error(String(error))
          node.dependencyRuntime.loading.value = false
        })
      },
    })
  }

  /**
   * 判断调度器是否没有待执行 microtask 或 dirty nodes。
   */
  isIdle(): boolean {
    return this.scheduler.isIdle()
  }

  /**
   * 释放所有已排队但尚未执行的任务。
   */
  dispose(): void {
    this.scheduler.dispose()
  }
}
