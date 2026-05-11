/**
 * Runtime 空闲状态追踪。
 *
 * dependency renderer 与字段 dynamic props resolver 都可能异步完成；
 * submit 前通过 waitForIdle 等待它们全部落定，避免用旧 schema/rules 校验。
 *
 * @module core/runtime/idle
 */

import type { DependencyScheduler } from "../scheduler/dependencyScheduler"
import type { Values } from "../types"

export class RuntimeIdleTracker<T extends Values = Values> {
  /** 当前仍在执行或已入队但未完成的异步 runtime 工作数量 */
  private pendingCount = 0

  constructor(private readonly scheduler: DependencyScheduler<T>) {}

  /**
   * 追踪 dependency renderer 与字段属性 resolver 的 pending 数变化。
   */
  readonly handlePendingChange = (delta: number): void => {
    this.pendingCount = Math.max(0, this.pendingCount + delta)
  }

  /**
   * 判断 runtime 是否没有待完成的异步任务和 dependency 脏队列任务。
   */
  isIdle(): boolean {
    return this.pendingCount === 0 && this.scheduler.isIdle()
  }

  /**
   * 等待 runtime 异步工作完成，或在超时后返回 false。
   */
  waitForIdle(timeout: number = 10000): Promise<boolean> {
    if (this.isIdle()) {
      return Promise.resolve(true)
    }

    return new Promise((resolve) => {
      const start = Date.now()

      const check = () => {
        if (this.isIdle()) {
          resolve(true)

          return
        }

        if (Date.now() - start >= timeout) {
          resolve(false)

          return
        }

        // 这里使用 16ms 轮询，保持实现简单，也与旧 debounce/一帧刷新节奏接近。
        setTimeout(check, 16)
      }

      setTimeout(check, 0)
    })
  }

  /**
   * 重置 pending 计数。
   */
  reset(): void {
    this.pendingCount = 0
  }
}
