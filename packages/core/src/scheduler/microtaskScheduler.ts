/**
 * 微任务批量调度器
 *
 * 将同一个同步执行栈内的多个任务收集到 microtask 阶段统一 flush。
 * 这是内部通用基础设施；业务侧应优先使用领域封装，例如
 * createFieldInitScheduler 或 DependencyScheduler。
 *
 * @module core/scheduler/microtaskScheduler
 */

/**
 * 公共调度任务。
 *
 * @typeParam P - phase 类型
 */
export interface CommonSchedulerTask<P extends string = string> {
  /** 执行阶段；未提供时使用 options.defaultPhase。 */
  phase?: P
  /** 去重 key；同 phase 内相同 key 只保留最后一次任务。 */
  dedupeKey?: string
  /** 实际任务逻辑。 */
  run: () => void | Promise<void>
  /** 调度层兜底错误处理；未提供时错误会向 flush 调用方抛出。 */
  onError?: (error: unknown) => void
}

/**
 * 公共调度器配置。
 *
 * @typeParam P - phase 类型
 */
export interface CommonSchedulerOptions<P extends string = string> {
  /** phase 刷新顺序。 */
  phases?: readonly P[]
  /** 未指定 phase 时使用的默认阶段。 */
  defaultPhase?: P
}

/**
 * 公共调度器实例。
 */
export interface CommonScheduler<P extends string = string> {
  enqueue: (task: CommonSchedulerTask<P>) => void
  flush: () => Promise<void>
  clear: () => void
  size: () => number
  isIdle: () => boolean
  dispose: () => void
}

/**
 * 创建公共微任务调度器。
 *
 * 支持 phase ordering、dedupe key、batch boundary、异步任务 idle tracking。
 * 领域侧应通过 `createRuntimeScheduler`、`createFieldInitScheduler` 等薄封装使用。
 */
export function createCommonScheduler<P extends string = "main">(
  options: CommonSchedulerOptions<P> = {}
): CommonScheduler<P> {
  const phases = [...(options.phases ?? (["main"] as P[]))]
  const defaultPhase = options.defaultPhase ?? phases[0]
  let queue = createQueue(phases)
  let scheduled = false
  let flushing = false
  let runningCount = 0
  let disposed = false

  const scheduleFlush = (): void => {
    if (scheduled || flushing || disposed) return

    scheduled = true
    Promise.resolve().then(() => {
      void flush()
    })
  }

  const enqueue = (task: CommonSchedulerTask<P>): void => {
    if (disposed) return

    const phase = task.phase ?? defaultPhase
    const phaseQueue = queue.get(phase) ?? ensurePhaseQueue(queue, phase)

    if (task.dedupeKey != null) {
      phaseQueue.deduped.set(task.dedupeKey, task)
    } else {
      phaseQueue.tasks.push(task)
    }

    scheduleFlush()
  }

  const flush = async (): Promise<void> => {
    if (disposed || flushing) return

    scheduled = false

    const batch = takeCurrentBatch()
    if (batch.length === 0) return

    flushing = true

    try {
      for (const task of batch) {
        if (disposed) return

        runningCount += 1
        try {
          const result = task.run()

          if (isPromiseLike(result)) {
            await result
          }
        } catch (error) {
          if (task.onError) {
            task.onError(error)
          } else {
            throw error
          }
        } finally {
          runningCount -= 1
        }
      }
    } finally {
      flushing = false

      if (!disposed && size() > 0) {
        scheduleFlush()
      }
    }
  }

  const clear = (): void => {
    queue = createQueue(phases)
    scheduled = false
  }

  const size = (): number => {
    let count = 0

    for (const phaseQueue of queue.values()) {
      count += phaseQueue.tasks.length + phaseQueue.deduped.size
    }

    return count
  }

  const isIdle = (): boolean => {
    return !scheduled && !flushing && runningCount === 0 && size() === 0
  }

  const dispose = (): void => {
    clear()
    disposed = true
  }

  return { enqueue, flush, clear, size, isIdle, dispose }

  function takeCurrentBatch(): CommonSchedulerTask<P>[] {
    const current = queue
    queue = createQueue(phases)

    return phases.flatMap((phase) => {
      const phaseQueue = current.get(phase)

      if (!phaseQueue) return []

      return [...phaseQueue.tasks, ...phaseQueue.deduped.values()]
    })
  }
}

interface CommonSchedulerQueue<P extends string> {
  tasks: CommonSchedulerTask<P>[]
  deduped: Map<string, CommonSchedulerTask<P>>
}

function createQueue<P extends string>(
  phases: readonly P[]
): Map<P, CommonSchedulerQueue<P>> {
  return new Map(phases.map((phase) => [phase, createPhaseQueue<P>()]))
}

function ensurePhaseQueue<P extends string>(
  queue: Map<P, CommonSchedulerQueue<P>>,
  phase: P
): CommonSchedulerQueue<P> {
  const phaseQueue = createPhaseQueue<P>()
  queue.set(phase, phaseQueue)

  return phaseQueue
}

function createPhaseQueue<P extends string>(): CommonSchedulerQueue<P> {
  return {
    tasks: [],
    deduped: new Map(),
  }
}

/**
 * 微任务调度器配置。
 *
 * @typeParam T - 任务类型
 */
export interface MicrotaskSchedulerOptions<T> {
  /**
   * 批量刷新回调，接收本轮 microtask 收集到的任务。
   *
   * @param tasks - 收集到的任务数组
   */
  flush: (tasks: T[]) => void

  /**
   * 可选去重键。
   *
   * 提供后，同一个 key 在一个 microtask 窗口内只保留最后一次任务。
   *
   * @param task - 任务对象
   * @returns 去重 key
   */
  dedupKey?: (task: T) => string
}

/**
 * 微任务调度器实例。
 *
 * @typeParam T - 任务类型
 */
export interface MicrotaskScheduler<T> {
  /** 将任务放入当前 microtask 批处理窗口。 */
  batch: (task: T) => void
  /** 立即刷新当前队列。 */
  flush: () => void
  /** 清空当前队列。 */
  clear: () => void
  /** 当前待处理任务数。 */
  size: () => number
  /** 当前是否没有待处理任务和已注册 microtask。 */
  isIdle: () => boolean
  /** 销毁调度器。 */
  dispose: () => void
}

/**
 * 创建内部通用微任务调度器。
 *
 * @param options - 调度器配置
 * @returns 微任务调度器实例
 */
export function createMicrotaskScheduler<T>(
  options: MicrotaskSchedulerOptions<T>
): MicrotaskScheduler<T> {
  const { flush: flushFn, dedupKey } = options
  const scheduler = createCommonScheduler()
  let queue: T[] = []
  let dedupMap: Map<string, T> | undefined = dedupKey ? new Map() : undefined
  let disposed = false

  const runFlush = (): void => {
    const tasks = dedupMap ? [...dedupMap.values()] : queue

    if (tasks.length === 0) return

    queue = []
    if (dedupMap) dedupMap = new Map()

    flushFn(tasks)
  }

  const batch = (task: T): void => {
    if (disposed) return

    if (dedupMap && dedupKey) {
      dedupMap.set(dedupKey(task), task)
    } else {
      queue.push(task)
    }

    scheduler.enqueue({
      dedupeKey: "microtask-flush",
      run: runFlush,
    })
  }

  const flush = (): void => {
    void scheduler.flush()
  }

  const clear = (): void => {
    queue = []
    if (dedupMap) dedupMap = new Map()
    scheduler.clear()
  }

  const size = (): number => {
    return dedupMap ? dedupMap.size : queue.length
  }

  const isIdle = (): boolean => {
    return scheduler.isIdle()
  }

  const dispose = (): void => {
    queue = []
    if (dedupMap) dedupMap = new Map()
    disposed = true
    scheduler.dispose()
  }

  return { batch, flush, clear, size, isIdle, dispose }
}

function isPromiseLike(value: void | Promise<void>): value is Promise<void> {
  return (
    value != null &&
    typeof (value as { then?: unknown }).then === "function"
  )
}
