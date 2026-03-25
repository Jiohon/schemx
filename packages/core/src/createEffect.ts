/**
 * createEffect - 底层通用 Signal effect 工具
 *
 * 直接封装 `@preact/signals-core` 的 `effect`，不依赖 form 实例，
 * 提供最底层的响应式 effect 能力。在 effect 回调中访问任何 Signal 值时
 * 自动追踪依赖，依赖变化时自动重新执行回调。
 *
 * 相比 `createWatch` 系列函数（需要传入 form 实例，提供结构化的 payload 和 diff 计算），
 * `createEffect` 更底层、更灵活，不做任何值比较或 payload 封装。
 *
 * 支持 cleanup 机制：effect 回调可返回一个清理函数，
 * 该函数会在 effect 重新执行前或被 dispose 时自动调用。
 *
 * @module core/createEffect
 *
 * @example
 * ```ts
 * import { createEffect } from '@schemx/core'
 * import { signal } from '@preact/signals-core'
 *
 * const count = signal(0)
 *
 * const dispose = createEffect(() => {
 *   console.log('count:', count.value)
 *   return () => {
 *     console.log('cleanup')
 *   }
 * })
 *
 * count.value = 1  // 先输出 "cleanup"，再输出 "count: 1"
 * dispose()        // 输出 "cleanup"，取消 effect
 * ```
 */

import { effect as signalEffect } from "@preact/signals-core"

/** effect 回调的清理函数类型 */
export type CleanupFn = () => void

/** effect 回调类型，可选返回清理函数 */
export type EffectCallback = () => CleanupFn | void

/** createEffect 的返回类型 - 取消 effect 的 dispose 函数（幂等） */
export type CreateEffectReturn = () => void

/**
 * 创建通用 Signal effect，直接封装 @preact/signals-core 的 effect。
 *
 * 在 effect 回调中访问任何 Signal 值时自动追踪依赖，
 * 依赖变化时自动重新执行回调。
 * 回调可返回一个清理函数，在 effect 重新执行前或被 dispose 时调用。
 *
 * @param callback - effect 回调函数，可选返回清理函数
 *
 * @returns 取消 effect 的 dispose 函数（幂等）
 *
 * @example
 * ```ts
 * import { createEffect } from '@schemx/core'
 * import { signal } from '@preact/signals-core'
 *
 * const count = signal(0)
 * const dispose = createEffect(() => {
 *   console.log('count:', count.value)
 *   return () => console.log('cleanup')
 * })
 *
 * count.value = 1  // effect 自动重新执行
 * dispose()        // 取消 effect，调用最后一次 cleanup
 * ```
 */
export function createEffect(callback: EffectCallback): CreateEffectReturn {
  let cleanup: CleanupFn | undefined
  let disposed = false

  const dispose = signalEffect(() => {
    cleanup?.()
    cleanup = undefined

    const result = callback()
    if (typeof result === "function") {
      cleanup = result
    }
  })

  return () => {
    if (disposed) return
    disposed = true
    dispose()
    cleanup?.()
    cleanup = undefined
  }
}
