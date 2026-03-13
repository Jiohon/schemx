/**
 * 异步工具函数
 *
 * @module utils/async
 */

/**
 * 创建一个带锁的异步函数
 *
 * 当函数正在执行时，重复调用会直接返回同一个 Promise，
 * 执行完成后自动释放锁，下次调用重新执行。
 *
 * @param fn - 要加锁的异步函数
 * @returns 加锁后的函数
 *
 * @example
 * ```typescript
 * const lockedSubmit = withLock(async () => {
 *   await api.submit(data)
 * })
 *
 * // 连续调用只会执行一次，返回同一个 Promise
 * lockedSubmit()
 * lockedSubmit() // 复用上一次的 Promise
 * ```
 */
export function withLock<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  let pending: Promise<any> | null = null

  return ((...args: any[]) => {
    if (pending) return pending

    pending = fn(...args).finally(() => {
      pending = null
    })

    return pending
  }) as T
}
