/**
 * Runtime 统一调度器。
 *
 * 用于承载 runtime 内部的 dependency、dynamic prop、validation 等任务，
 * 按 phase 保证执行顺序，并在同一 batch boundary 内支持按 key 去重。
 *
 * @module core/scheduler/runtimeScheduler
 */

import { createCommonScheduler } from "./microtaskScheduler"

export type RuntimeSchedulerPhase = "pre" | "main" | "post"

export type RuntimeSchedulerJobType =
  | "dependency"
  | "dynamic-prop"
  | "validation"
  | "field"
  | (string & {})

export interface RuntimeSchedulerJob {
  /** 任务类型，用于和 dedupeKey 组成去重边界。 */
  type: RuntimeSchedulerJobType
  /** 执行阶段；默认进入 main。 */
  phase?: RuntimeSchedulerPhase
  /** 同一 phase 内相同 type + dedupeKey 只保留最后一次任务。 */
  dedupeKey?: string
  /** 实际任务逻辑。 */
  run: () => void | Promise<void>
  /** 调度层兜底错误处理；未提供时错误会重新抛到 microtask。 */
  onError?: (error: unknown) => void
}

export interface RuntimeScheduler {
  /** 将任务加入下一轮 microtask batch。 */
  enqueue: (job: RuntimeSchedulerJob) => void
  /** 立即刷新当前 batch；刷新期间新加入的任务会进入下一轮 batch。 */
  flush: () => Promise<void>
  /** 清空尚未执行的任务。 */
  clear: () => void
  /** 当前尚未执行的任务数。 */
  size: () => number
  /** 当前是否没有排队、刷新中或异步运行中的任务。 */
  isIdle: () => boolean
  /** 销毁调度器并清空队列。 */
  dispose: () => void
}

const PHASES: RuntimeSchedulerPhase[] = ["pre", "main", "post"]

export function createRuntimeScheduler(): RuntimeScheduler {
  const scheduler = createCommonScheduler<RuntimeSchedulerPhase>({
    phases: PHASES,
    defaultPhase: "main",
  })

  const enqueue = (job: RuntimeSchedulerJob): void => {
    scheduler.enqueue({
      phase: job.phase,
      dedupeKey: job.dedupeKey == null ? undefined : createDedupeKey(job),
      run: job.run,
      onError: job.onError,
    })
  }

  return {
    enqueue,
    flush: scheduler.flush,
    clear: scheduler.clear,
    size: scheduler.size,
    isIdle: scheduler.isIdle,
    dispose: scheduler.dispose,
  }
}

function createDedupeKey(job: RuntimeSchedulerJob): string {
  return `${job.type}:${job.dedupeKey}`
}
