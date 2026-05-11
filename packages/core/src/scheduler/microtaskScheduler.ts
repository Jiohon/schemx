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

  let queue: T[] = []
  let dedupMap: Map<string, T> | undefined = dedupKey ? new Map() : undefined
  let scheduled = false
  let disposed = false

  const doFlush = (): void => {
    scheduled = false

    if (disposed) return

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

    if (!scheduled) {
      scheduled = true
      Promise.resolve().then(doFlush)
    }
  }

  const flush = (): void => {
    if (scheduled) {
      doFlush()
    }
  }

  const clear = (): void => {
    queue = []
    if (dedupMap) dedupMap = new Map()
    scheduled = false
  }

  const size = (): number => {
    return dedupMap ? dedupMap.size : queue.length
  }

  const isIdle = (): boolean => {
    return !scheduled && size() === 0
  }

  const dispose = (): void => {
    clear()
    disposed = true
  }

  return { batch, flush, clear, size, isIdle, dispose }
}
