/**
 * SignalMap - 基于 @preact/signals-core 的通用响应式键值对管理类
 *
 * 封装"按 key 管理 signal + effect/batch + dispose 清理"的通用能力，
 * 供 FormStore（管理字段值）和 Validator（管理 errors）复用。
 *
 * @typeParam K - 键类型
 * @typeParam V - 值类型
 *
 * @example
 * ```typescript
 * const map = new SignalMap<string, number>()
 * map.set('count', 0)
 * map.get('count') // => 0
 *
 * map.effect(() => {
 *   console.log('count:', map.get('count'))
 * })
 *
 * map.set('count', 1) // effect 自动重新执行，输出: count: 1
 * ```
 *
 * @remarks
 * signal 为内部实现细节，不对外暴露。所有状态变更通过 effect 自动感知。
 */

import {
  type Signal,
  signal,
  batch as signalBatch,
  effect as signalEffect,
} from "@preact/signals-core"

export class SignalMap<K, V> {
  /** signal 存储：每个 key 对应一个独立的 Signal */
  private signals = new Map<K, Signal<V>>()

  /** 所有内部 effect 的 dispose 函数，用于统一清理 */
  private disposers = new Set<() => void>()

  /**
   * 结构版本号 signal，用于追踪"新 key 创建"事件。
   *
   * 当 get 访问不存在的 key 时，读取 version.value 建立依赖；
   * 当 set 创建新 key 时递增 version，触发依赖该 version 的 effect 重新执行。
   * 这解决了 effect 内首次 get 不存在的 key 后，无法感知该 key 后续被 set 的问题。
   */
  private version: Signal<number> = signal(0)

  /**
   * 读取指定 key 的 signal 值并追踪依赖。
   *
   * 在 signal effect 中调用时会自动收集依赖，当该 key 的值变化时触发 effect 重新执行。
   *
   * @param key - 要读取的键
   *
   * @returns 对应的值，key 不存在时返回 undefined
   *
   * @example
   * ```typescript
   * map.set('name', 'Alice')
   * map.get('name') // => 'Alice'
   * map.get('unknown') // => undefined
   * ```
   */
  get(key: K): V | undefined {
    const s = this.signals.get(key)
    if (s) return s.value

    // key 不存在时读取 version signal 建立依赖，
    // 后续 set 创建该 key 时 version 递增，触发 effect 重新执行
    void this.version.value

    return undefined
  }

  /**
   * 写入指定 key 的 signal 值。
   *
   * 如果 key 已存在，更新对应 signal 的值并触发依赖该 signal 的 effect；
   * 如果 key 不存在，自动创建新的 signal。
   *
   * @param key - 要写入的键
   * @param value - 要设置的值
   *
   * @example
   * ```typescript
   * map.set('count', 0)   // 创建新 signal
   * map.set('count', 1)   // 更新已有 signal，触发 effect
   * ```
   */
  set(key: K, value: V): void {
    const s = this.signals.get(key)
    if (s) {
      s.value = value
    } else {
      this.signals.set(key, signal(value))
      // 新 key 创建，递增 version 通知依赖了不存在 key 的 effect
      this.version.value++
    }
  }

  /**
   * 读取指定 key 的 signal 值，但不追踪依赖。
   *
   * 适用于 getSnapshot 等不需要响应式追踪的场景。
   *
   * @param key - 要读取的键
   *
   * @returns 对应的值，key 不存在时返回 undefined
   *
   * @example
   * ```typescript
   * map.set('name', 'Alice')
   * map.peek('name') // => 'Alice'，不会被 effect 追踪
   * ```
   */
  peek(key: K): V | undefined {
    return this.signals.get(key)?.peek()
  }

  /**
   * 基于当前值更新指定 key 的 signal 值。
   *
   * 内部使用 peek 获取当前值传给 updater，再将 updater 返回值写入 signal。
   * 如果 key 不存在，updater 接收 undefined 作为 prev，并创建新 signal。
   *
   * @param key - 要更新的键
   * @param updater - 更新函数，接收当前值，返回新值
   *
   * @example
   * ```typescript
   * map.set('count', 1)
   * map.update('count', (prev) => prev + 1)
   * map.get('count') // => 2
   * ```
   */
  update(key: K, updater: (prev: V) => V): void {
    const prev = this.peek(key)
    this.set(key, updater(prev as V))
  }

  /**
   * 判断指定 key 对应的 signal 是否存在。
   *
   * @param key - 要检查的键
   *
   * @returns key 存在返回 true，否则返回 false
   *
   * @example
   * ```typescript
   * map.set('name', 'Alice')
   * map.has('name')    // => true
   * map.has('unknown') // => false
   * ```
   */
  has(key: K): boolean {
    return this.signals.has(key)
  }

  /**
   * 删除指定 key 对应的 signal。
   *
   * 先从 Map 中移除 Signal，然后在 batch 中同时：
   * 1. 修改被删除 Signal 的值（触发依赖该 Signal 的 effect 重新执行）
   * 2. 递增 version（触发依赖 version 的 effect 重新执行）
   *
   * effect 重新执行时 key 已不存在，get 会走到 version 分支重新建立依赖，
   * 避免 effect 持有对已删除 Signal 的悬空引用导致后续更新丢失。
   *
   * key 不存在时静默忽略（幂等操作）。
   *
   * @param key - 要删除的键
   *
   * @example
   * ```typescript
   * map.set('name', 'Alice')
   * map.delete('name')
   * map.has('name') // => false
   * ```
   */
  delete(key: K): void {
    const s = this.signals.get(key)
    if (!s) return

    this.signals.delete(key)

    signalBatch(() => {
      // 触发依赖该 Signal 的 effect 重新执行
      s.value = undefined as unknown as V
      this.version.value++
    })
  }

  /**
   * 清空所有 key 及其对应的 signal。
   *
   * 先收集所有 Signal 引用并清空 Map，然后在 batch 中修改所有旧 Signal 值
   * 并递增 version，确保依赖任意已删除 key 的 effect 都能重新执行。
   *
   * @example
   * ```typescript
   * map.set('a', 1)
   * map.set('b', 2)
   * map.clear()
   * map.has('a') // => false
   * ```
   */
  clear(): void {
    if (this.signals.size === 0) return

    const oldSignals = [...this.signals.values()]
    this.signals.clear()

    signalBatch(() => {
      for (const s of oldSignals) {
        s.value = undefined as unknown as V
      }

      this.version.value++
    })
  }

  /**
   * 遍历当前所有已注册的 key。
   *
   * @returns 包含所有 key 的 IterableIterator
   *
   * @example
   * ```typescript
   * map.set('a', 1)
   * map.set('b', 2)
   * for (const key of map.keys()) {
   *   console.log(key) // 'a', 'b'
   * }
   * ```
   */
  keys(): IterableIterator<K> {
    return this.signals.keys()
  }

  /**
   * 返回所有 Signal 值的迭代器。
   *
   * 注意：返回的是原始 Signal 对象，不是解包后的值。
   * 如需获取解包后的值快照，请使用 {@link peekAll}。
   *
   * @returns 包含所有 Signal 值的 IterableIterator
   *
   * @example
   * ```typescript
   * map.set('a', 1)
   * map.set('b', 2)
   * for (const sig of map.values()) {
   *   console.log(sig.value)
   * }
   * ```
   */
  values(): IterableIterator<Signal<V>> {
    return this.signals.values()
  }

  /**
   * 返回所有 key-Signal 对的迭代器。
   *
   * 注意：返回的 value 是原始 Signal 对象，不是解包后的值。
   * 如需获取解包后的值快照，请使用 {@link peekAll}。
   *
   * @returns 包含所有 [key, Signal] 对的 IterableIterator
   *
   * @example
   * ```typescript
   * map.set('a', 1)
   * map.set('b', 2)
   * for (const [key, sig] of map.entries()) {
   *   console.log(key, sig.value)
   * }
   * ```
   */
  entries(): IterableIterator<[K, Signal<V>]> {
    return this.signals.entries()
  }

  /**
   * 获取所有值的快照，不追踪依赖。
   *
   * 内部使用 peek 读取每个 signal 的值，避免在 effect 中产生依赖追踪。
   *
   * @returns 包含所有 key-value 对的 Map 快照
   *
   * @example
   * ```typescript
   * map.set('a', 1)
   * map.set('b', 2)
   * const snapshot = map.getSnapshot() // Map { 'a' => 1, 'b' => 2 }
   * ```
   */
  getSnapshot(): Map<K, V> {
    const result = new Map<K, V>()
    for (const [key, s] of this.signals) {
      result.set(key, s.peek())
    }

    return result
  }

  /**
   * 封装 @preact/signals-core 的 effect，统一管理 dispose。
   *
   * 创建的 effect 会被纳入内部 disposers 集合，调用 destroy 时统一清理。
   * 返回的取消函数调用后会同时从 disposers 中移除。
   *
   * @param fn - effect 回调函数
   *
   * @returns 取消 effect 的函数
   *
   * @example
   * ```typescript
   * map.set('count', 0)
   * const dispose = map.effect(() => {
   *   console.log('count:', map.get('count'))
   * })
   * // 输出: count: 0（首次执行）
   * map.set('count', 1) // 输出: count: 1
   * dispose() // 取消 effect
   * ```
   */
  effect(fn: () => void): () => void {
    const dispose = signalEffect(fn)
    this.disposers.add(dispose)

    return () => {
      dispose()
      this.disposers.delete(dispose)
    }
  }

  /**
   * 封装 @preact/signals-core 的 batch，将多次 signal 写入合并为一次 effect 触发。
   *
   * @param fn - 批量操作函数
   *
   * @example
   * ```typescript
   * map.batch(() => {
   *   map.set('a', 1)
   *   map.set('b', 2)
   * })
   * // 依赖 a 或 b 的 effect 只触发一次
   * ```
   */
  batch(fn: () => void): void {
    signalBatch(fn)
  }

  /**
   * 销毁 SignalMap 实例，释放所有资源。
   *
   * dispose 所有通过 `effect` 方法创建的 effect，并清空所有 signal。
   * 调用后行为等同于空 map。
   *
   * @example
   * ```typescript
   * map.destroy()
   * map.get('any') // => undefined
   * ```
   */
  destroy(): void {
    for (const dispose of this.disposers) {
      dispose()
    }

    this.disposers.clear()
    this.signals.clear()
  }
}
