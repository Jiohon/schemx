/**
 * RuntimeScheduler
 *
 * 统一运行时调度器。
 *
 * 合并：
 * - dependency scheduler
 * - dependencies scheduler
 * - validation scheduler
 * - idle tracker
 *
 * 职责：
 * - job 去重
 * - phase 顺序执行
 * - microtask 批处理
 * - async pending tracking
 * - whenIdle 等待稳定状态
 */

export type SchedulerPhase = "pre" | "main" | "post"

export type RuntimeJobChannel =
  | "fieldInit"
  | "dependencies"
  | "dependency"
  | "validation"
  | "renderer"
  | "cleanup"

export interface RuntimeJob {
  channel: RuntimeJobChannel
  key: string
  run: () => void | Promise<void>
  onError?: (error: unknown) => void
}

export interface RuntimeScheduler {
  queue: (job: RuntimeJob) => void
  flush: () => Promise<void>
  whenIdle: (timeout?: number) => Promise<boolean>
  isIdle: () => boolean
  track: <T>(task: Promise<T>) => Promise<T>
  clear: () => void
  dispose: () => void
}

const CHANNEL_PHASE: Record<RuntimeJobChannel, SchedulerPhase> = {
  fieldInit: "pre",
  dependencies: "pre",
  dependency: "main",
  validation: "post",
  renderer: "post",
  cleanup: "post",
}

const PHASES: SchedulerPhase[] = ["pre", "main", "post"]

interface PhaseQueue {
  deduped: Map<string, RuntimeJob>
}

export function createRuntimeScheduler(): RuntimeScheduler {
  let queues = createQueues()

  let scheduled = false
  let flushing = false
  let disposed = false
  let pendingAsync = 0
  let currentFlush: Promise<void> | null = null

  const idleResolvers = new Set<(idle: boolean) => void>()

  function queue(job: RuntimeJob): void {
    if (disposed) return

    const phase = CHANNEL_PHASE[job.channel]
    const phaseQueue = queues.get(phase)

    phaseQueue?.deduped.set(`${job.channel}:${job.key}`, job)

    scheduleFlush()
  }

  function scheduleFlush(): void {
    if (scheduled || flushing || disposed) return

    scheduled = true

    queueMicrotask(() => {
      void flush().catch((error: unknown) => {
        setTimeout(() => {
          throw error
        }, 0)
      })
    })
  }

  function flush(): Promise<void> {
    if (disposed) {
      return Promise.resolve()
    }

    if (currentFlush) {
      return currentFlush
    }

    currentFlush = doFlush().finally(() => {
      currentFlush = null

      if (!disposed && hasJobs()) {
        scheduleFlush()
      }

      notifyIdleIfNeeded()
    })

    return currentFlush
  }

  async function doFlush(): Promise<void> {
    if (flushing || disposed) return

    flushing = true
    scheduled = false

    try {
      const batch = takeBatch()

      for (const job of batch) {
        if (disposed) return

        try {
          const result = job.run()

          if (isPromiseLike(result)) {
            await track(result)
          }
        } catch (error) {
          if (job.onError) {
            job.onError(error)
          } else {
            throw error
          }
        }
      }
    } finally {
      flushing = false
    }
  }

  async function track<T>(task: Promise<T>): Promise<T> {
    pendingAsync += 1

    try {
      return await task
    } finally {
      pendingAsync -= 1
      notifyIdleIfNeeded()
    }
  }

  function isIdle(): boolean {
    return disposed || (!scheduled && !flushing && pendingAsync === 0 && !hasJobs())
  }

  function whenIdle(timeout = 10000): Promise<boolean> {
    if (disposed) {
      return Promise.resolve(false)
    }

    if (isIdle()) {
      return Promise.resolve(true)
    }

    return new Promise<boolean>((resolve) => {
      let settled = false

      const finish = (value: boolean) => {
        if (settled) return

        settled = true
        idleResolvers.delete(finish)
        clearTimeout(timer)
        resolve(value)
      }

      const timer = setTimeout(() => {
        finish(false)
      }, timeout)

      idleResolvers.add(finish)
    })
  }

  function notifyIdleIfNeeded(): void {
    if (!isIdle()) return

    const resolvers = Array.from(idleResolvers)
    idleResolvers.clear()

    for (const resolve of resolvers) {
      resolve(true)
    }
  }

  function clear(): void {
    queues = createQueues()
    scheduled = false
  }

  function dispose(): void {
    disposed = true
    clear()

    const resolvers = Array.from(idleResolvers)
    idleResolvers.clear()

    for (const resolve of resolvers) {
      resolve(false)
    }
  }

  function hasJobs(): boolean {
    for (const queue of queues.values()) {
      if (queue.deduped.size > 0) {
        return true
      }
    }

    return false
  }

  function takeBatch(): RuntimeJob[] {
    const current = queues
    queues = createQueues()

    return PHASES.flatMap((phase) => {
      const queue = current.get(phase)

      if (!queue) return []

      return [...queue.deduped.values()]
    })
  }

  return {
    queue,
    flush,
    whenIdle,
    isIdle,
    track,
    clear,
    dispose,
  }
}

function createQueues(): Map<SchedulerPhase, PhaseQueue> {
  return new Map(
    PHASES.map((phase) => [
      phase,
      {
        deduped: new Map(),
      },
    ])
  )
}

function isPromiseLike<T = unknown>(value: unknown): value is Promise<T> {
  return value != null && typeof (value as { then?: unknown }).then === "function"
}
