/**
 * Subscriber - 发布订阅管理器
 *
 * 纯事件分发模块，无框架依赖，不持有 store 引用。
 * 职责：管理字段级订阅和全局订阅，接收调用方传入的数据进行分发。
 *
 * @module core/subscriber
 *
 * @example
 * ```typescript
 * import { createSubscriber } from './Subscriber'
 *
 * const subscriber = createSubscriber<FormValues>()
 *
 * // 订阅单个字段
 * const unsubscribe = subscriber.subscribe('name', (payload, prevSnapshot, latestSnapshot) => {
 *   console.log(`${payload.path} changed to ${payload.value}`)
 * })
 *
 * // 订阅所有变化
 * subscriber.subscribeAll((payload, prevSnapshot, latestSnapshot) => {
 *   console.log('Changed:', payload.changedValues)
 * })
 *
 * // 通知变化
 * subscriber.notify({ name: 'John' }, { name: 'OldName' }, prevSnapshot, latestSnapshot)
 *
 * // 取消订阅
 * unsubscribe()
 * ```
 */

import type { DeepReadonly } from "vue"

import { collectObjectPaths, getByPath, pickByPaths } from "../utils/path"

import type { FormValues, NamePath, Value } from "../types"

/** 变化前的表单全量值快照（只读） */
export type PrevSnapshot<T> = DeepReadonly<T> | T
/** 变化后的表单全量值快照（只读） */
export type LatestSnapshot<T> = DeepReadonly<T> | T

/** 单字段订阅回调的载荷 */
type FieldPayload<T> = {
  /** 发生变更的字段路径 */
  path: NamePath<T>
  /** 变更后的字段值 */
  value: Value
  /** 变更前的字段值 */
  prevValue: Value
}

/** 多字段订阅回调的载荷 */
type FieldsPayload<T> = {
  /** 本次变更涉及的字段值（部分表单数据） */
  changedValues: DeepReadonly<Partial<T>>
  /** 变更前对应字段的旧值（部分表单数据） */
  prevValues: DeepReadonly<Partial<T>>
}

/** 全局订阅回调的载荷 */
type GlobalPayload<T> = {
  /** 本次变更涉及的所有字段路径 */
  changedPaths: NamePath<T>[]
  /** 本次变更涉及的字段值（部分表单数据） */
  changedValues: DeepReadonly<Partial<T>>
  /** 变更前对应字段的旧值（部分表单数据） */
  prevValues: DeepReadonly<Partial<T>>
}

/**
 * 订阅回调的基础类型。
 *
 * 回调接收三个参数：变更载荷（payload）、变更前的表单完整快照（prevSnapshot）、
 * 变更后的表单最新快照（latestSnapshot）。
 */
type BaseSubscribeCallback<T, P> = (
  payload: P,
  prevSnapshot: PrevSnapshot<T>,
  latestSnapshot: LatestSnapshot<T>
) => void

/** 单字段订阅回调类型，监听指定字段的变更 */
export type FieldSubscribeCallback<T> = BaseSubscribeCallback<T, FieldPayload<T>>

/** 多字段订阅回调类型，监听一组字段的变更 */
export type FieldsSubscribeCallback<T> = BaseSubscribeCallback<T, FieldsPayload<T>>

/** 全局订阅回调类型，监听表单中任意字段的变更 */
export type GlobalSubscribeCallback<T> = BaseSubscribeCallback<T, GlobalPayload<T>>

/**
 * 发布订阅事件分发器。
 *
 * 不持有 store 引用，所有数据由调用方传入。
 * 支持单字段订阅、多字段组订阅和全局订阅三种模式。
 *
 * @typeParam T - 表单值类型
 *
 * @example
 * ```typescript
 * const subscriber = new Subscriber<FormValues>()
 * const unsub = subscriber.subscribe('name', (payload) => {
 *   console.log(payload.value)
 * })
 * ```
 *
 * @remarks
 * 单字段订阅精确匹配路径；多字段组订阅在任一字段变化时以组为单位触发一次；
 * 全局订阅在任意字段变化时触发。
 */
export class Subscriber<T extends FormValues> {
  /** 字段订阅者映射 */
  private fieldSubscribers = new Map<NamePath<T>, Set<FieldSubscribeCallback<T>>>()

  /** 多字段组订阅者映射（key 为 paths 排序后序列化） */
  private fieldsSubscribers = new Map<
    string,
    { paths: Set<NamePath<T>>; callbacks: Set<FieldsSubscribeCallback<T>> }
  >()

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
   * const unsubscribe = subscriber.subscribe('name', (payload, prevSnapshot, latestSnapshot) => {
   *   console.log(`${payload.path} changed to ${payload.value}`)
   * })
   *
   * // 订阅嵌套字段，当 'user.address' 或其子路径变化时都会触发
   * subscriber.subscribe('user.address', (payload) => {
   *   console.log('Address changed:', payload.value)
   * })
   *
   * unsubscribe()
   * ```
   */
  subscribe(path: NamePath<T>, callback: FieldSubscribeCallback<T>): () => void {
    if (path === undefined || path === null) return () => {}

    if (!this.fieldSubscribers.has(path)) {
      this.fieldSubscribers.set(path, new Set())
    }

    this.fieldSubscribers.get(path)?.add(callback)

    return () => {
      this.fieldSubscribers.get(path)?.delete(callback)
    }
  }

  /**
   * 订阅多个字段变化（多字段组订阅）
   *
   * 当任一指定字段变化时，以组为单位触发一次回调，传入所有订阅字段的值快照。
   * 同一批次 setFieldsValue 改了多个订阅字段时，只触发一次。
   *
   * @param paths - 要订阅的字段路径数组
   * @param callback - 变化时的回调函数，接收 (payload, prevSnapshot, latestSnapshot)
   * @returns 取消订阅的函数
   *
   * @example
   * ```typescript
   * const unsubscribe = subscriber.subscribeFields(
   *   ['name', 'email'],
   *   (payload, prevSnapshot, latestSnapshot) => {
   *     console.log('subscribed fields:', payload.changedValues)
   *   }
   * )
   *
   * unsubscribe()
   * ```
   */
  subscribeFields(
    paths: NamePath<T>[],
    callback: FieldsSubscribeCallback<T>
  ): () => void {
    if (!paths || paths.length === 0) return () => {}

    // 排序后序列化作为 key，保证 ['name','age'] 和 ['age','name'] 是同一组
    const key = [...paths].sort().join("|")

    if (!this.fieldsSubscribers.has(key)) {
      this.fieldsSubscribers.set(key, {
        paths: new Set(paths),
        callbacks: new Set(),
      })
    }

    this.fieldsSubscribers.get(key)?.callbacks.add(callback)

    return () => {
      const sub = this.fieldsSubscribers.get(key)
      if (sub) {
        sub.callbacks.delete(callback)
        if (sub.callbacks.size === 0) {
          this.fieldsSubscribers.delete(key)
        }
      }
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
   * const unsubscribe = subscriber.subscribeAll((payload, prevSnapshot, latestSnapshot) => {
   *   console.log('Changed paths:', payload.changedPaths)
   *   console.log('Changed values:', payload.changedValues)
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
   * 批量通知所有相关订阅者（字段级、多字段组、全局）。
   *
   * 依次执行：逐字段精确通知 → 多字段组通知 → 全局通知。
   *
   * @param changedValues - 已变化的字段值对象（部分）
   * @param prevValues - 变化前的字段旧值（部分）
   * @param prevSnapshot - 变化前的全量值快照
   * @param latestSnapshot - 变化后的全量值快照
   */
  notify(
    changedValues: DeepReadonly<Partial<T>>,
    prevSnapshot: PrevSnapshot<T>,
    latestSnapshot: LatestSnapshot<T>
  ): void {
    const changedPaths = collectObjectPaths(changedValues)

    // 1. 逐字段通知（精确匹配）
    for (const path of changedPaths) {
      const value = getByPath(changedValues, path)
      const prevValue = getByPath(prevSnapshot, path)

      this.notifyField(path, value, prevValue, prevSnapshot, latestSnapshot)
    }

    // 2. 多字段组通知
    this.notifyFieldFields(changedPaths, prevSnapshot, latestSnapshot)

    // 3. 全局通知
    this.notifyGlobal(
      changedPaths,
      changedValues,

      prevSnapshot,
      latestSnapshot
    )
  }

  /**
   * 通知单个字段变化
   *
   * 通知精确匹配该路径的订阅者，以及关联的父路径和子路径订阅者。
   *
   * @param path - 变化的字段路径
   * @param value - 变化后的值
   * @param prevValue - 变化前的值
   * @param prevSnapshot - 变化前的全量值快照
   * @param latestSnapshot - 变化后的全量值快照
   *
   * @example
   * ```typescript
   * subscriber.notifyField('user.address.city', 'Beijing', 'Shanghai', prevSnapshot, latestSnapshot)
   * // 触发：'user.address.city' 的订阅者
   * ```
   */
  private notifyField(
    path: NamePath<T>,
    value: Value,
    prevValue: Value,
    prevSnapshot: PrevSnapshot<T>,
    latestSnapshot: LatestSnapshot<T>
  ): void {
    const payload: FieldPayload<T> = { path, value, prevValue }
    // 精确匹配
    this.fieldSubscribers
      .get(path)
      ?.forEach((cb) => cb(payload, prevSnapshot, latestSnapshot))
  }

  /**
   * 通知多字段组订阅者
   *
   * 检查 changedPaths 和每个订阅组的 paths 是否有交集，
   * 有交集则从全量快照中提取子集传给回调，每组只触发一次。
   *
   * @param changedPaths - 本次变更涉及的字段路径数组
   * @param prevSnapshot - 变更前的全量值快照
   * @param latestSnapshot - 变更后的全量值快照
   */
  private notifyFieldFields(
    changedPaths: NamePath<T>[],
    prevSnapshot: PrevSnapshot<T>,
    latestSnapshot: LatestSnapshot<T>
  ): void {
    if (this.fieldsSubscribers.size === 0) return

    const changedSet = new Set<NamePath<T>>(changedPaths)

    for (const [, { paths, callbacks }] of this.fieldsSubscribers) {
      // 检查订阅的 paths 和 changedPaths 是否有交集
      const hasIntersection = [...paths].some((p) => changedSet.has(p))

      if (hasIntersection) {
        const changedValues = pickByPaths(latestSnapshot, paths) as DeepReadonly<
          Partial<T>
        >

        const prevValues = pickByPaths(prevSnapshot, paths) as DeepReadonly<Partial<T>>
        const payload: FieldsPayload<T> = { changedValues, prevValues }

        callbacks.forEach((cb) => cb(payload, prevSnapshot, latestSnapshot))
      }
    }
  }

  /**
   * 通知全局订阅者
   *
   * @param changedPaths - 本次变更涉及的字段路径数组
   * @param changedValues - 变更后的字段值（部分）
   * @param prevValues - 变更前的字段旧值（部分）
   * @param prevSnapshot - 变更前的全量值快照
   * @param latestSnapshot - 变更后的全量值快照
   */
  private notifyGlobal(
    changedPaths: NamePath<T>[],
    changedValues: DeepReadonly<Partial<T>>,
    prevSnapshot: PrevSnapshot<T>,
    latestSnapshot: LatestSnapshot<T>
  ): void {
    const prevValues = pickByPaths(
      prevSnapshot,
      new Set([...changedPaths])
    ) as DeepReadonly<Partial<T>>

    const payload: GlobalPayload<T> = { changedPaths, changedValues, prevValues }
    this.globalSubscribers.forEach((cb) => cb(payload, prevSnapshot, latestSnapshot))
  }

  /**
   * 清除所有订阅（字段级、多字段组、全局）。
   *
   * 移除所有已注册的订阅回调，通常在表单销毁时调用。
   *
   * @example
   * ```typescript
   * subscriber.clear()
   * ```
   */
  clear(): void {
    this.fieldSubscribers.clear()
    this.fieldsSubscribers.clear()
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

    for (const { callbacks } of this.fieldsSubscribers.values()) {
      count += callbacks.size
    }

    return count + this.globalSubscribers.size
  }
}

/**
 * 创建 Subscriber 实例的工厂函数。
 *
 * @typeParam T - 表单值类型
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
