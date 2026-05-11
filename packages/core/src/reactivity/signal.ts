/**
 * 框架无关的 reactive signal 门面。
 *
 * core 其他模块只能依赖这里导出的类型和工厂，不能直接感知
 * @preact/signals-core，方便未来替换底层 reactivity 实现。
 *
 * @module core/reactivity/signal
 */

import { signal } from "@preact/signals-core"

/**
 * reactive signal 的只读视图。
 */
export interface ReadonlyReactiveSignal<T> {
  readonly value: T
  peek: () => T
}

/**
 * core 内部使用的可写 reactive signal。
 */
export interface ReactiveSignal<T> {
  value: T
  peek: () => T
}

/**
 * 创建 reactive signal，但不暴露具体实现类型。
 */
export function createSignal<T>(value: T): ReactiveSignal<T> {
  return signal(value)
}
