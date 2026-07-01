/**
 * computed 门面。
 *
 * 对 `@preact/signals-core` 的 `computed` 做一层薄封装，让 core 内部模块
 * 不直接耦合底层响应式库路径。业务模块统一通过本文件导入 `createComputed`
 * 和只读 computed 类型。
 *
 * @module core/reactivity/computed
 */

import { computed } from "@preact/signals-core"

import type { ReadonlySignal, SignalOptions } from "@preact/signals-core"

/**
 * 只读 computed signal 类型。
 *
 * 与 `ReadonlySignal<T>` 语义一致，仅用于在类型层面标记该 signal
 * 由 computed 派生，不可外部写入。
 *
 * @typeParam T - computed 值类型
 */
export type ComputedSignal<T> = ReadonlySignal<T>

/**
 * 创建 computed signal。
 *
 * `compute` 函数中读取的 signal 会自动成为依赖；当依赖变化时 computed
 * 值会懒计算失效，下次读取时重新求值。
 *
 * @typeParam T - computed 值类型
 * @param compute - 计算函数，内部读取的 signal 自动成为依赖
 * @param options - signals-core 原生 signal 配置
 * @returns 只读 computed signal
 */
export function createComputed<T>(
  compute: () => T,
  options?: SignalOptions<T>
): ComputedSignal<T> {
  return computed(compute, options)
}
