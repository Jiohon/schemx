/**
 * 字段初始化微任务调度器
 *
 * 将多个 FormItem 挂载时触发的初始值写入收集到一个 microtask
 * 窗口内，统一批量执行，避免字段初始化阶段反复触发 store 更新。
 *
 * @module core/form/fieldInitScheduler
 *
 * @example
 * ```typescript
 * const scheduler = createFieldInitScheduler<{ name: string; value: unknown }>({
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

import {
  createMicrotaskScheduler,
  type MicrotaskScheduler,
  type MicrotaskSchedulerOptions,
} from "../scheduler/microtaskScheduler"

/**
 * 批量调度器配置选项
 *
 * @typeParam T - 任务类型
 */
export type FieldInitSchedulerOptions<T> = MicrotaskSchedulerOptions<T>

/**
 * 批量调度器实例接口
 *
 * @typeParam T - 任务类型
 */
export type FieldInitScheduler<T> = MicrotaskScheduler<T>

/**
 * 创建字段初始化微任务调度器
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
 * const scheduler = createFieldInitScheduler<string>({
 *   flush: (tasks) => console.log('batch:', tasks),
 * })
 * scheduler.batch('a')
 * scheduler.batch('b')
 * // microtask 时输出: batch: ['a', 'b']
 *
 * // 有去重
 * const scheduler = createFieldInitScheduler<{ key: string; val: number }>({
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
export function createFieldInitScheduler<T>(
  options: FieldInitSchedulerOptions<T>
): FieldInitScheduler<T> {
  return createMicrotaskScheduler(options)
}
