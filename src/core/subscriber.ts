/**
 * Subscriber - 发布订阅管理器
 *
 * 纯事件分发模块，无框架依赖，不持有 store 引用。
 * 职责：管理字段级订阅和全局订阅，接收调用方传入的数据进行分发。
 *
 * @module core/Subscriber
 *
 * @example
 * ```typescript
 * import { createSubscriber } from './Subscriber'
 *
 * const subscriber = createSubscriber<FormValues>()
 *
 * // 订阅单个字段
 * const unsubscribe = subscriber.subscribe('name', (path, value, latestValues) => {
 *   console.log(`${path} changed to ${value}`)
 * })
 *
 * // 订阅所有变化
 * subscriber.subscribeAll((latestValues, changedValues) => {
 *   console.log('Changed:', changedValues)
 * })
 *
 * // 通知变化
 * const latestValues = store.getFieldsValue()
 * subscriber.notify({ name: 'John' }, latestValues)
 *
 * // 取消订阅
 * unsubscribe()
 * ```
 */

import type { DeepReadonly } from "vue"

import { collectObjectPaths, getByPath } from "../utils/path"

import type { FormValues, NamePath, Value } from "../types"

/**
 * 字段订阅回调函数类型
 *
 * @param path - 变化的字段路径
 * @param value - 变化后的值
 * @param latestValues - 所有字段的当前值
 */
export type FieldSubscribeCallback<T> = (
  path: NamePath,
  value: Value,
  prevValue: Value,
  latestValues: DeepReadonly<Partial<T>>
) => void

/**
 * 全局订阅回调函数类型
 *
 * @param latestValues - 所有字段的当前值
 * @param changedValues - 变化的字段值对象
 * @param changedFields - 变化的顶层字段名列表
 * @param changedPaths - 变化的完整路径列表（含嵌套叶子路径）
 */
export type GlobalSubscribeCallback<T> = (
  changedValues: DeepReadonly<Partial<T>>,
  prevValues: DeepReadonly<Partial<T>>,
  latestValues: DeepReadonly<T>,
  changedPaths: NamePath<T>[]
) => void

/**
 * Subscriber 类 - 纯事件分发器
 *
 * 不持有 store 引用，所有数据由调用方传入。
 * 支持字段级订阅（含父/子路径联动）和全局订阅。
 */
export class Subscriber<T extends FormValues> {
  /** 字段订阅者映射 */
  private fieldSubscribers = new Map<NamePath<T>, Set<FieldSubscribeCallback<T>>>()

  /** 全局订阅者集合 */
  private globalSubscribers = new Set<GlobalSubscribeCallback<T>>()

  /**
   * 订阅字段变化
   *
   * 当订阅的字段或其父/子路径发生变化时，都会收到通知。
   *
   * @param path - 要订阅的字段路径
   * @param callback - 变化时的回调函数
   * @returns 取消订阅的函数
   *
   * @example
   * ```typescript
   * const unsubscribe = subscriber.subscribe('name', (path, value, latestValues) => {
   *   console.log(`${path} changed to ${value}`)
   * })
   *
   * // 订阅嵌套字段，当 'user.address' 或其子路径变化时都会触发
   * subscriber.subscribe('user.address', (path, value) => {
   *   console.log('Address changed:', value)
   * })
   *
   * unsubscribe()
   * ```
   */
  subscribe(path: NamePath<T>, callback: FieldSubscribeCallback<T>): () => void {
    if (!this.fieldSubscribers.has(path)) {
      this.fieldSubscribers.set(path, new Set())
    }

    this.fieldSubscribers.get(path)?.add(callback)

    return () => {
      this.fieldSubscribers.get(path)?.delete(callback)
    }
  }

  /**
   * 订阅多个字段变化
   *
   * 当任一指定字段变化时触发回调，返回一个取消所有订阅的函数。
   *
   * @param paths - 要订阅的字段路径数组
   * @param callback - 变化时的回调函数
   * @returns 取消所有订阅的函数
   *
   * @example
   * ```typescript
   * const unsubscribe = subscriber.subscribeFields(
   *   ['name', 'email', 'phone'],
   *   (path, value, latestValues) => {
   *     console.log(`${path} changed to ${value}`)
   *   }
   * )
   *
   * unsubscribe()
   * ```
   */
  subscribeFields(paths: NamePath<T>[], callback: FieldSubscribeCallback<T>): () => void {
    const unsubscribes = paths.map((p) => this.subscribe(p, callback))

    return () => {
      unsubscribes.forEach((unsub) => unsub())
    }
  }

  /**
   * 订阅所有字段变化
   *
   * 当任何字段值变化时都会收到通知，适用于表单级别的监听（如 onValuesChange）。
   *
   * @param callback - 变化时的回调函数
   * @returns 取消订阅的函数
   *
   * @example
   * ```typescript
   * const unsubscribe = subscriber.subscribeAll((latestValues, changedValues, changedFields, changedPaths) => {
   *   console.log('Changed fields:', changedFields)
   *   console.log('Changed paths:', changedPaths)
   * })
   *
   * unsubscribe()
   * ```
   */
  subscribeAll(callback: GlobalSubscribeCallback<T>): () => void {
    this.globalSubscribers.add(callback)

    return () => {
      this.globalSubscribers.delete(callback)
    }
  }

  /**
   * 批量通知变化
   *
   * 传入已变化的值对象和当前全量值，逐字段通知订阅者（含父/子路径），最后通知全局订阅者。
   *
   * @param changedValues - 已变化的字段值对象
   * @param latestValues - 所有字段的当前值
   *
   * @example
   * ```typescript
   * const latestValues = store.getFieldsValue()
   * subscriber.notify({ name: 'John', age: 25 }, latestValues)
   * ```
   */
  notify(
    changedValues: DeepReadonly<Partial<T>>,
    prevValues: DeepReadonly<Partial<T>>,
    latestValues: DeepReadonly<T>
  ): void {
    const changedPaths = collectObjectPaths(changedValues)

    // 逐字段通知（精确匹配 + 关联路径）
    for (const path of changedPaths) {
      const value = getByPath(changedValues, path)
      const prevValue = getByPath(prevValues, path)

      this.notifyField(path, value, prevValue, latestValues)
    }

    this.notifyGlobal(changedValues, prevValues, latestValues, changedPaths)
  }

  /**
   * 通知单个字段变化
   *
   * 通知精确匹配该路径的订阅者，以及关联的父路径和子路径订阅者。
   *
   * @param path - 变化的字段路径
   * @param value - 变化后的值
   * @param latestValues - 所有字段的当前值
   *
   * @example
   * ```typescript
   * const latestValues = store.getFieldsValue()
   * subscriber.notifyField('user.address.city', 'Beijing', latestValues)
   * // 触发：'user.address.city' → 'user.address' → 'user' 的订阅者
   * ```
   */
  private notifyField(
    path: NamePath<T>,
    value: Value,
    prevValue: Value,
    latestValues: DeepReadonly<T>
  ): void {
    // 精确匹配
    this.fieldSubscribers
      .get(path)
      ?.forEach((cb) => cb(path, value, prevValue, latestValues))
  }

  /**
   * 通知全局订阅者（内部）
   */
  private notifyGlobal(
    changedValues: DeepReadonly<Partial<T>>,
    prevValues: DeepReadonly<Partial<T>>,
    latestValues: DeepReadonly<T>,
    changedPaths: NamePath<T>[]
  ): void {
    this.globalSubscribers.forEach((cb) =>
      cb(changedValues, prevValues, latestValues, changedPaths)
    )
  }

  /**
   * 清除所有订阅
   *
   * 移除所有字段订阅和全局订阅，通常在表单销毁时调用。
   *
   * @example
   * ```typescript
   * subscriber.clear()
   * ```
   */
  clear(): void {
    this.fieldSubscribers.clear()
    this.globalSubscribers.clear()
  }

  /**
   * 获取订阅者数量
   *
   * 传入路径时返回该字段的订阅者数量，不传则返回所有订阅者总数（含全局）。
   *
   * @param path - 字段路径，不传则返回总数
   * @returns 订阅者数量
   *
   * @example
   * ```typescript
   * subscriber.getSubscriberCount('name')  // => 2
   * subscriber.getSubscriberCount()        // => 10
   * ```
   */
  getSubscriberCount(path?: NamePath<T>): number {
    if (path) {
      return this.fieldSubscribers.get(path)?.size ?? 0
    }

    let count = 0
    for (const subscribers of this.fieldSubscribers.values()) {
      count += subscribers.size
    }

    return count + this.globalSubscribers.size
  }
}

/**
 * 创建 Subscriber 实例的工厂函数
 *
 * @returns Subscriber 实例
 *
 * @example
 * ```typescript
 * const subscriber = createSubscriber<FormValues>()
 * ```
 */
export function createSubscriber<T extends FormValues>(): Subscriber<T> {
  return new Subscriber<T>()
}

export default Subscriber
