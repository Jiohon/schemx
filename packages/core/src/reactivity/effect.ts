/**
 * 框架无关的 reactive effect 门面。
 *
 * createForm 和 ReactiveMap 都通过这里创建 effect，不直接 import
 * @preact/signals-core。
 *
 * @module core/reactivity/effect
 */

import { effect } from "@preact/signals-core"

/**
 * reactive effect 的释放函数。
 */
export type SignalEffectDispose = () => void

/**
 * 创建 reactive effect，但不暴露具体 reactivity 后端。
 *
 * @param fn - effect 回调，执行期间读取的 signal 会被追踪。
 * @returns 释放该 effect 的函数。
 */
export function createSignalEffect(fn: () => void): SignalEffectDispose {
  return effect(fn)
}
