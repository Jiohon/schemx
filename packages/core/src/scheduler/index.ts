/**
 * 通用微任务批量调度器
 *
 * 将多个分散的同步调用收集到一个 microtask 窗口内，统一批量执行。
 * 适用于多个组件各自独立调用但需要合并为一次批量操作的场景，
 * 例如表单初始化时多个 FormItem 的 setValue 合并为一次 batch。
 *
 * @module core/scheduler
 *
 * @example
 * ```typescript
 * const scheduler = createBatchScheduler<{ name: string; value: unknown }>({
 *   flush: (tasks) => {
 *     form.batch(() => {
 *       for (const t of tasks) {
 *         form.setFieldValue(t.name, t.value)
 *       }
 *     })
 *   },
 *   dedupKey: (task) => task.name,
 * })
 *
 * scheduler.batch({ name: "userType", value: "personal" })
 * scheduler.batch({ name: "companyName", value: "" })
 * ```
 */

/**
 * 批量调度器配置选项
 *
 * @typeParam T - 任务类型
 */
export interface BatchSchedulerOptions<T> {
  /**
   * 批量刷新回调，接收收集到的所有任务
   *
   * @param tasks - 收集到的任务数组（无去重时按入队顺序，有去重时同 key 只保留最后一次）
   */
  flush: (tasks: T[]) => void

  /**
   * 可选的去重键提取函数
   *
   * 提供后，同一个 key 多次 batch() 只保留最后一次的任务。
   * 未提供时所有任务按入队顺序保留。
   *
   * @param task - 任务对象
   * @returns 用于去重的字符串 key
   */
  dedupKey?: (task: T) => string
}

/**
 * 批量调度器实例接口
 *
 * @typeParam T - 任务类型
 */
export interface BatchScheduler<T> {
  /**
   * 将任务收集到批量队列中。
   * 首次调用时自动注册 microtask，后续同步栈内的调用只入队不重复注册。
   *
   * @param task - 要收集的任务
   */
  batch: (task: T) => void

  /**
   * 手动立即刷新队列中的所有任务。
   * 调用后清空队列并取消已注册的 microtask。
   * 主要用于测试场景，生产环境通常依赖 microtask 自动刷新。
   */
  flush: () => void

  /**
   * 清空队列中的所有任务，不执行 flush 回调。
   * 如果有已注册的 microtask，同时取消。
   */
  clear: () => void

  /**
   * 返回当前队列中待处理的任务数量。
   *
   * @returns 待处理任务数
   */
  size: () => number

  /**
   * 销毁调度器，清空队列并取消已注册的 microtask。
   * 销毁后再调用 batch() 会被静默忽略。
   */
  dispose: () => void
}

/**
 * 创建微任务批量调度器
 *
 * 同一个同步执行栈内的多次 batch() 调用会被收集，
 * 在 microtask 阶段通过 Promise.resolve().then 统一调用 flush 回调。
 * 支持可选的按 key 去重。
 *
 * @typeParam T - 任务类型
 *
 * @param options - 调度器配置
 *
 * @returns 调度器实例，包含 batch、flush、clear、size、dispose 方法
 *
 * @example
 * ```typescript
 * // 无去重
 * const scheduler = createBatchScheduler<string>({
 *   flush: (tasks) => console.log('batch:', tasks),
 * })
 * scheduler.batch('a')
 * scheduler.batch('b')
 * // microtask 时输出: batch: ['a', 'b']
 *
 * // 有去重
 * const scheduler = createBatchScheduler<{ key: string; val: number }>({
 *   flush: (tasks) => console.log('batch:', tasks),
 *   dedupKey: (t) => t.key,
 * })
 * scheduler.batch({ key: 'x', val: 1 })
 * scheduler.batch({ key: 'x', val: 2 })
 * // microtask 时输出: batch: [{ key: 'x', val: 2 }]
 * ```
 *
 * @remarks
 * 使用 Promise.resolve().then 作为调度机制，确保在同一个事件循环的
 * microtask 阶段执行。这比 setTimeout(0) 更快，且能保证在 Vue 的
 * onMounted 等同步生命周期钩子全部执行完后立即 flush。
 */
export function createBatchScheduler<T>(
  options: BatchSchedulerOptions<T>
): BatchScheduler<T> {
  const { flush: flushFn, dedupKey } = options

  /** 无去重模式的任务队列 */
  let queue: T[] = []

  /** 去重模式的任务映射（保持插入顺序） */
  let dedupMap: Map<string, T> | undefined = dedupKey ? new Map() : undefined

  /** 是否已注册 microtask */
  let scheduled = false

  /** 是否已销毁 */
  let disposed = false

  /**
   * 执行 flush：取出所有任务，清空队列，调用 flush 回调
   */
  const doFlush = (): void => {
    scheduled = false

    if (disposed) return

    const tasks = dedupMap ? [...dedupMap.values()] : queue

    if (tasks.length === 0) return

    // 先清空再 flush，防止 flush 内部 batch() 导致任务丢失
    queue = []
    if (dedupMap) dedupMap = new Map()

    flushFn(tasks)
  }

  const batch = (task: T): void => {
    if (disposed) return

    if (dedupMap && dedupKey) {
      const key = dedupKey(task)
      dedupMap.set(key, task)
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

  const dispose = (): void => {
    clear()
    disposed = true
  }

  return { batch, flush, clear, size, dispose }
}
