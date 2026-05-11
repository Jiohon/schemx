/**
 * 框架无关的 reactive effect 门面。
 *
 * createForm、runtime、ReactiveMap 都通过这里创建 effect，不直接 import
 * @preact/signals-core。
 *
 * @module core/reactivity/effect
 */

import { effect } from "@preact/signals-core"

/** reactive effect 的释放函数。 */
export type ReactiveEffectDispose = () => void

/**
 * 创建 reactive effect，但不暴露具体 reactivity 后端。
 */
export function createReactiveEffect(fn: () => void): ReactiveEffectDispose {
  return effect(fn)
}
