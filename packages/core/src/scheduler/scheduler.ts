/**
 * 调度器执行阶段。
 *
 * 定义 job 的执行顺序，按 pre → main → post 顺序执行。
 *
 * - `pre`: 初始化阶段，处理字段初始化和依赖关系建立
 * - `main`: 主阶段，处理依赖更新
 * - `post`: 后处理阶段，处理验证、渲染和清理
 */
export type SchedulerPhase = "pre" | "main" | "post"

/**
 * 调度器作业通道。
 *
 * 定义不同类型的作业来源，每个通道映射到特定的执行阶段。
 *
 * - `fieldInit`: 字段初始化 (pre 阶段)
 * - `dependencies`: 批量依赖关系建立 (pre 阶段)
 * - `dependency`: 单个依赖更新 (main 阶段)
 * - `validation`: 字段验证 (post 阶段)
 * - `renderer`: 渲染更新 (post 阶段)
 * - `cleanup`: 清理作业 (post 阶段)
 */
export type RuntimeJobChannel =
  | "fieldInit"
  | "dependencies"
  | "dependency"
  | "validation"
  | "renderer"
  | "cleanup"

/**
 * 调度器作业。
 *
 * 表示一个待执行的调度单元，包含执行逻辑、去重标识和错误处理。
 */
export interface RuntimeJob {
  /**
   * 作业通道，决定执行阶段。
   */
  channel: RuntimeJobChannel

  /**
   * 作业去重键。
   *
   * 格式为 `${channel}:${key}`，相同键的作业会被去重。
   */
  key: string

  /**
   * 作业执行函数。
   *
   * 支持同步或异步执行，异步作业会被自动追踪。
   */
  run: () => void | Promise<void>

  /**
   * 可选的错误处理回调。
   *
   * 当作业执行失败时调用，未提供时错误会被重新抛出。
   *
   * @param error - 捕获的错误对象
   */
  onError?: (error: unknown) => void
}

/**
 * 统一运行时调度器接口。
 *
 * 提供作业调度、异步追踪、空闲状态检测等核心能力。
 *
 * @example
 * ```ts
 * const scheduler = createRuntimeScheduler()
 *
 * scheduler.queue({
 *   channel: 'validation',
 *   key: 'field1',
 *   run: () => validateField('field1')
 * })
 *
 * await scheduler.whenIdle()
 * scheduler.dispose()
 * ```
 *
 * @remarks
 * 调度器合并了依赖调度、验证调度和空闲追踪功能，
 * 通过 microtask 批处理和阶段顺序执行确保高效的更新机制。
 */
export interface RuntimeScheduler {
  /**
   * 将作业加入调度队列。
   *
   * 作业会根据通道映射到对应阶段，相同键的作业会被去重。
   * 调度器会在下一个 microtask 批量执行所有待处理作业。
   *
   * @param job - 要调度的作业
   */
  queue: (job: RuntimeJob) => void

  /**
   * 手动触发队列刷新。
   *
   * 立即执行所有待处理的作业，返回刷新完成的 Promise。
   * 如果已有刷新进行中，返回当前的刷新 Promise。
   *
   * @returns 刷新完成的 Promise
   */
  flush: () => Promise<void>

  /**
   * 等待调度器进入空闲状态。
   *
   * 当队列为空且没有异步作业在进行时返回 true。
   * 如果超时则返回 false。
   *
   * @param timeout - 超时时间（毫秒），默认 10000
   * @returns 是否成功进入空闲状态
   */
  whenIdle: (timeout?: number) => Promise<boolean>

  /**
   * 检查调度器是否处于空闲状态。
   *
   * 空闲条件：队列为空、无正在执行的刷新、无待处理的异步作业。
   *
   * @returns 是否空闲
   */
  isIdle: () => boolean

  /**
   * 追踪异步任务。
   *
   * 将异步任务纳入调度器的异步计数管理，
   * 确保 whenIdle 能正确等待该任务完成。
   *
   * @typeParam T - 任务返回值类型
   * @param task - 要追踪的 Promise
   * @returns 原始任务的 Promise
   */
  track: <T>(task: Promise<T>) => Promise<T>

  /**
   * 清空调度队列。
   *
   * 移除所有待处理的作业，重置调度状态。
   * 正在执行的刷新不会被打断。
   */
  clear: () => void

  /**
   * 销毁调度器。
   *
   * 清空队列，拒绝所有等待空闲的 Promise，
   * 后续的队列操作将被忽略。
   */
  dispose: () => void
}

/**
 * 通道到阶段的映射表。
 *
 * 定义每个作业通道所属的执行阶段。
 */
const CHANNEL_PHASE: Record<RuntimeJobChannel, SchedulerPhase> = {
  fieldInit: "pre",
  dependencies: "pre",
  dependency: "main",
  validation: "post",
  renderer: "post",
  cleanup: "post",
}

/**
 * 阶段执行顺序。
 *
 * 按 pre → main → post 顺序定义执行顺序。
 */
const PHASES: SchedulerPhase[] = ["pre", "main", "post"]

/**
 * 阶段队列结构。
 */
interface PhaseQueue {
  /**
   * 去重后的作业映射。
   *
   * 键格式为 `${channel}:${key}`。
   */
  deduped: Map<string, RuntimeJob>
}

/**
 * 创建运行时调度器实例。
 *
 * @returns 调度器实例
 *
 * @example
 * ```ts
 * const scheduler = createRuntimeScheduler()
 *
 * // 调度验证作业
 * scheduler.queue({
 *   channel: 'validation',
 *   key: 'user.email',
 *   run: async () => {
 *     const valid = await validateEmail(formData.email)
 *     if (!valid) setFieldError('email', 'Invalid email')
 *   },
 *   onError: (err) => console.error('Validation failed:', err)
 * })
 *
 * // 等待所有作业完成
 * const idle = await scheduler.whenIdle(5000)
 * if (!idle) {
 *   console.warn('Scheduler did not settle within timeout')
 * }
 * ```
 *
 * @remarks
 * 调度器实现以下核心机制：
 *
 * **作业去重**：相同 `${channel}:${key}` 的作业只保留最新一个
 *
 * **阶段执行**：按 pre → main → post 顺序批量执行，确保依赖关系正确
 *
 * **Microtask 批处理**：所有作业在同一个 microtask 中批量执行，减少重复计算
 *
 * **异步追踪**：自动追踪异步作业，whenIdle 会等待所有异步作业完成
 *
 * **空闲检测**：提供 isIdle 和 whenIdle 用于检测调度器状态
 */
export function createRuntimeScheduler(): RuntimeScheduler {
  let queues = createQueues()

  // 是否已调度刷新
  let scheduled = false
  // 是否正在刷新中
  let flushing = false
  // 是否已销毁
  let disposed = false
  // 待处理的异步作业计数
  let pendingAsync = 0
  // 当前刷新操作的 Promise
  let currentFlush: Promise<void> | null = null

  // 等待空闲状态的 resolve 函数集合
  const idleResolvers = new Set<(idle: boolean) => void>()

  /**
   * 将作业加入调度队列。
   */
  function queue(job: RuntimeJob): void {
    if (disposed) return

    const phase = CHANNEL_PHASE[job.channel]
    const phaseQueue = queues.get(phase)

    phaseQueue?.deduped.set(`${job.channel}:${job.key}`, job)

    scheduleFlush()
  }

  /**
   * 调度刷新任务到 microtask。
   */
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

  /**
   * 执行队列刷新。
   *
   * 如果已有刷新进行中，返回当前刷新 Promise。
   */
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

  /**
   * 执行实际的刷新逻辑。
   */
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

  /**
   * 追踪异步任务。
   */
  async function track<T>(task: Promise<T>): Promise<T> {
    pendingAsync += 1

    try {
      return await task
    } finally {
      pendingAsync -= 1
      notifyIdleIfNeeded()
    }
  }

  /**
   * 检查是否处于空闲状态。
   */
  function isIdle(): boolean {
    return disposed || (!scheduled && !flushing && pendingAsync === 0 && !hasJobs())
  }

  /**
   * 等待空闲状态。
   */
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

  /**
   * 通知所有等待空闲的 resolve 函数。
   */
  function notifyIdleIfNeeded(): void {
    if (!isIdle()) return

    const resolvers = Array.from(idleResolvers)
    idleResolvers.clear()

    for (const resolve of resolvers) {
      resolve(true)
    }
  }

  /**
   * 清空调度队列。
   */
  function clear(): void {
    queues = createQueues()
    scheduled = false
  }

  /**
   * 销毁调度器。
   */
  function dispose(): void {
    disposed = true
    clear()

    const resolvers = Array.from(idleResolvers)
    idleResolvers.clear()

    for (const resolve of resolvers) {
      resolve(false)
    }
  }

  /**
   * 检查是否有待处理的作业。
   */
  function hasJobs(): boolean {
    for (const queue of queues.values()) {
      if (queue.deduped.size > 0) {
        return true
      }
    }

    return false
  }

  /**
   * 取出当前所有作业作为批处理。
   */
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

/**
 * 创建空的阶段队列。
 *
 * @returns 包含所有阶段的空队列映射
 */
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

/**
 * 检查值是否为 Promise 类型。
 *
 * @typeParam T - Promise 返回值类型
 * @param value - 要检查的值
 * @returns 是否为 Promise 类型
 */
function isPromiseLike<T = unknown>(value: unknown): value is Promise<T> {
  return value != null && typeof (value as { then?: unknown }).then === "function"
}
