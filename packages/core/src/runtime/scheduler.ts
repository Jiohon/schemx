/**
 * Runtime dependency 微任务调度器
 *
 * 将 dependency 变更收集到 microtask 队列中统一刷新，避免同一个同步栈内
 * 多次 setFieldValue 导致 dependency renderer 递归、重复执行。
 *
 * @module core/runtime/scheduler
 */

import { createMicrotaskScheduler } from "../scheduler/microtaskScheduler"

import type { Values } from "../types"
import type { DependencyRuntimeNode } from "./types"

/**
 * Runtime 调度器。
 *
 * @typeParam T - 表单值类型
 */
export class RuntimeScheduler<T extends Values = Values> {
  /** dependency dirty queue，同一个 runtime node key 在单个 microtask 内只执行一次 */
  private readonly scheduler = createMicrotaskScheduler<DependencyRuntimeNode<T>>({
    dedupKey: (node) => node.key,
    flush: (nodes) => {
      for (const node of nodes) {
        node.dirty = false
        node.run().catch((error) => {
          node.error.value = error
          node.loading.value = false
        })
      }
    },
  })

  /**
   * 将 dependency 节点加入 dirty queue。
   *
   * 同一个 microtask 窗口内，多次入队同一个节点只会执行一次 run。
   *
   * @param node - 需要重新执行 renderer 的 dependency runtime node
   */
  enqueueDependency(node: DependencyRuntimeNode<T>): void {
    if (node.disposed) return

    node.dirty = true
    this.scheduler.batch(node)
  }

  /**
   * 判断调度器是否没有待刷新任务。
   *
   * @returns 没有 pending microtask 且 dirty queue 为空时返回 true
   */
  isIdle(): boolean {
    return this.scheduler.isIdle()
  }
}
