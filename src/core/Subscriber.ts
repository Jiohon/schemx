/**
 * Subscriber - 发布订阅管理器
 *
 * 纯发布订阅模块，无框架依赖。
 * 职责：管理字段级订阅和全局订阅。
 *
 * @module core/Subscriber
 *
 * @example
 * ```typescript
 * import { createSubscriber } from './Subscriber'
 *
 * const subscriber = createSubscriber({
 *   getFieldValue: (path) => store.getFieldValue(path),
 *   getFieldsValue: () => store.getFieldsValue()
 * })
 *
 * // 订阅单个字段
 * const unsubscribe = subscriber.subscribe('name', (path, value, allValues) => {
 *   console.log(`${path} changed to ${value}`)
 * })
 *
 * // 订阅所有变化
 * subscriber.subscribeAll((changedValues, allValues) => {
 *   console.log('Changed:', changedValues)
 * })
 *
 * // 通知变化
 * subscriber.notifyField('name', 'John')
 * subscriber.notifyGlobal({ name: 'John' })
 *
 * // 取消订阅
 * unsubscribe()
 * ```
 */

/**
 * 字段订阅回调函数类型
 *
 * @param path - 变化的字段路径
 * @param value - 变化后的值
 * @param allValues - 所有字段的当前值
 */
export type FieldSubscribeCallback = (
  path: string,
  value: any,
  allValues: Record<string, any>
) => void

/**
 * 全局订阅回调函数类型
 *
 * @param changedValues - 变化的字段值对象
 * @param allValues - 所有字段的当前值
 */
export type GlobalSubscribeCallback = (
  changedValues: Record<string, any>,
  allValues: Record<string, any>
) => void

/**
 * 值获取器接口
 *
 * 用于获取字段值，由外部提供实现。
 */
export interface ValueGetter {
  /** 获取单个字段值 */
  getFieldValue: (path: string) => any
  /** 获取所有字段值 */
  getFieldsValue: () => Record<string, any>
}

/**
 * Subscriber 类 - 发布订阅管理器
 *
 * 支持字段级订阅和全局订阅，当字段值变化时通知相关订阅者。
 *
 * @example
 * ```typescript
 * const subscriber = new Subscriber({
 *   getFieldValue: (path) => values[path],
 *   getFieldsValue: () => values
 * })
 *
 * // 订阅嵌套字段
 * subscriber.subscribe('user.address.city', (path, value) => {
 *   console.log(`City changed to ${value}`)
 * })
 *
 * // 订阅父路径，当任何子路径变化时也会收到通知
 * subscriber.subscribe('user.address', (path, value) => {
 *   console.log('Address changed:', value)
 * })
 * ```
 */
export class Subscriber {
  /** 字段订阅者映射 */
  private fieldSubscribers = new Map<string, Set<FieldSubscribeCallback>>()

  /** 全局订阅者集合 */
  private globalSubscribers = new Set<GlobalSubscribeCallback>()

  /** 值获取器 */
  private valueGetter: ValueGetter

  constructor(valueGetter: ValueGetter) {
    this.valueGetter = valueGetter
  }

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
   * // 订阅单个字段
   * const unsubscribe = subscriber.subscribe('name', (path, value, allValues) => {
   *   console.log(`${path} changed to ${value}`)
   * })
   *
   * // 订阅嵌套字段
   * subscriber.subscribe('user.address.city', (path, value) => {
   *   console.log(`City: ${value}`)
   * })
   *
   * // 取消订阅
   * unsubscribe()
   * ```
   */
  subscribe(path: string, callback: FieldSubscribeCallback): () => void {
    if (!this.fieldSubscribers.has(path)) {
      this.fieldSubscribers.set(path, new Set())
    }

    this.fieldSubscribers.get(path)?.add(callback)

    return () => {
      this.fieldSubscribers.get(path)?.delete(callback)
    }
  }

  /**
   * 订阅所有字段变化
   *
   * 当任何字段值变化时都会收到通知。
   *
   * @param callback - 变化时的回调函数
   * @returns 取消订阅的函数
   *
   * @example
   * ```typescript
   * const unsubscribe = subscriber.subscribeAll((changedValues, allValues) => {
   *   console.log('Changed fields:', Object.keys(changedValues))
   * })
   *
   * // 取消订阅
   * unsubscribe()
   * ```
   */
  subscribeAll(callback: GlobalSubscribeCallback): () => void {
    this.globalSubscribers.add(callback)

    return () => {
      this.globalSubscribers.delete(callback)
    }
  }

  /**
   * 通知字段变化
   *
   * 会通知：
   * 1. 精确匹配该路径的订阅者
   * 2. 该路径的父路径订阅者
   * 3. 该路径的子路径订阅者
   *
   * @param path - 变化的字段路径
   * @param value - 变化后的值
   *
   * @example
   * ```typescript
   * // 通知 'user.address.city' 变化
   * // 会触发 'user.address.city'、'user.address'、'user' 的订阅者
   * subscriber.notifyField('user.address.city', 'Beijing')
   * ```
   */
  notifyField(path: string, value: any): void {
    const allValues = this.valueGetter.getFieldsValue()

    // 通知精确匹配的订阅者
    this.fieldSubscribers.get(path)?.forEach((cb) => cb(path, value, allValues))

    // 通知父路径订阅者
    const parts = path.split(".")
    for (let i = parts.length - 1; i > 0; i--) {
      const parentPath = parts.slice(0, i).join(".")
      const parentValue = this.valueGetter.getFieldValue(parentPath)
      this.fieldSubscribers
        .get(parentPath)
        ?.forEach((cb) => cb(parentPath, parentValue, allValues))
    }

    // 通知子路径订阅者
    for (const [subscribedPath, callbacks] of this.fieldSubscribers) {
      if (subscribedPath.startsWith(path + ".")) {
        const childValue = this.valueGetter.getFieldValue(subscribedPath)
        callbacks.forEach((cb) => cb(subscribedPath, childValue, allValues))
      }
    }
  }

  /**
   * 通知全局变化
   *
   * 通知所有全局订阅者。
   *
   * @param changedValues - 变化的字段值对象
   *
   * @example
   * ```typescript
   * subscriber.notifyGlobal({ name: 'John', age: 25 })
   * ```
   */
  notifyGlobal(changedValues: Record<string, any>): void {
    const allValues = this.valueGetter.getFieldsValue()
    this.globalSubscribers.forEach((cb) => cb(changedValues, allValues))
  }

  /**
   * 清除所有订阅
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
   * 获取字段订阅者数量
   *
   * @param path - 字段路径，不传则返回总数
   * @returns 订阅者数量
   *
   * @example
   * ```typescript
   * subscriber.getSubscriberCount('name') // => 2
   * subscriber.getSubscriberCount() // => 10
   * ```
   */
  getSubscriberCount(path?: string): number {
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
 * @param valueGetter - 值获取器
 * @returns Subscriber 实例
 *
 * @example
 * ```typescript
 * const subscriber = createSubscriber({
 *   getFieldValue: (path) => store.getFieldValue(path),
 *   getFieldsValue: () => store.getFieldsValue()
 * })
 * ```
 */
export function createSubscriber(valueGetter: ValueGetter): Subscriber {
  return new Subscriber(valueGetter)
}

export default Subscriber
