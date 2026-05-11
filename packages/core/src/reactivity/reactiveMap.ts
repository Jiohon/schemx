/**
 * ReactiveMap - 按 key 管理的响应式值存储。
 *
 * 封装“每个 key 一个 signal + effect/batch + dispose”能力，store 和 validator
 * 可以共享细粒度响应式能力，同时不依赖具体 signals 实现。
 *
 * @module core/reactivity/reactiveMap
 */

import { batchUpdates } from "./batch"
import { createReactiveEffect } from "./effect"
import { createSignal } from "./signal"

import type { ReactiveSignal } from "./signal"

export class ReactiveMap<K, V> {
  /** 每个 key 独占一个 signal，保证字段级更新能细粒度触发 */
  private signals = new Map<K, ReactiveSignal<V>>()

  /** 由当前 map 创建的 effect disposer，destroy 时统一释放 */
  private disposers = new Set<() => void>()

  /**
   * 结构版本 signal，用于追踪“新 key 创建”事件。
   *
   * effect 读取缺失 key 时会依赖这个版本；之后创建该 key 会推进版本，
   * 让 effect 重新执行并订阅新 key 对应的 signal。
   */
  private version: ReactiveSignal<number> = createSignal(0)

  /**
   * 读取 key，并在 effect 内自动收集响应式依赖。
   */
  get(key: K): V | undefined {
    const s = this.signals.get(key)
    if (s) return s.value

    void this.version.value

    return undefined
  }

  /**
   * 写入 key；如果 key 不存在，则创建新的 signal。
   */
  set(key: K, value: V): void {
    const s = this.signals.get(key)
    if (s) {
      s.value = value
    } else {
      this.signals.set(key, createSignal(value))
      this.version.value++
    }
  }

  /**
   * 无依赖追踪地读取 key。
   */
  peek(key: K): V | undefined {
    return this.signals.get(key)?.peek()
  }

  /**
   * 基于当前值更新 key。
   */
  update(key: K, updater: (prev: V) => V): void {
    const prev = this.peek(key)
    this.set(key, updater(prev as V))
  }

  /**
   * 判断 key 是否存在。
   */
  has(key: K): boolean {
    return this.signals.has(key)
  }

  /**
   * 删除 key，并通知订阅旧 signal 或 map 结构的 effects。
   */
  delete(key: K): void {
    const s = this.signals.get(key)
    if (!s) return

    this.signals.delete(key)

    batchUpdates(() => {
      s.value = undefined as unknown as V
      this.version.value++
    })
  }

  /**
   * 清空所有 key，并通知订阅任意被删除 signal 的 effects。
   */
  clear(): void {
    if (this.signals.size === 0) return

    const oldSignals = [...this.signals.values()]
    this.signals.clear()

    batchUpdates(() => {
      for (const s of oldSignals) {
        s.value = undefined as unknown as V
      }

      this.version.value++
    })
  }

  /**
   * 遍历所有已注册 key。
   */
  keys(): IterableIterator<K> {
    return this.signals.keys()
  }

  /**
   * 遍历内部 reactive signals。
   */
  values(): IterableIterator<ReactiveSignal<V>> {
    return this.signals.values()
  }

  /**
   * 遍历 key/signal 对。
   */
  entries(): IterableIterator<[K, ReactiveSignal<V>]> {
    return this.signals.entries()
  }

  /**
   * 无依赖追踪地读取全部值。
   */
  getSnapshot(): Map<K, V> {
    const result = new Map<K, V>()
    for (const [key, s] of this.signals) {
      result.set(key, s.peek())
    }

    return result
  }

  /**
   * 创建 reactive effect，并由当前 map 统一管理释放。
   */
  effect(fn: () => void): () => void {
    const dispose = createReactiveEffect(fn)
    this.disposers.add(dispose)

    return () => {
      dispose()
      this.disposers.delete(dispose)
    }
  }

  /**
   * 批量合并多次响应式写入。
   */
  batch(fn: () => void): void {
    batchUpdates(fn)
  }

  /**
   * 释放所有 effects 并清空内部存储。
   */
  destroy(): void {
    for (const dispose of this.disposers) {
      dispose()
    }

    this.disposers.clear()
    this.signals.clear()
  }
}
