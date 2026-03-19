/**
 * createWatch - 基于 Signal effect 的字段监听工具
 *
 * 提供不依赖任何 UI 框架的字段监听能力，基于 form.effect() 自动依赖追踪。
 * 适用于非组件场景（如工具函数、外部逻辑）。
 *
 * 所有回调采用 payload 模式：`(payload, latestSnapshot)`，
 * payload 包含变更的详细信息，latestSnapshot 为变更后的表单完整快照。
 *
 * @module core/createWatch
 *
 * @example
 * ```ts
 * import { createWatchField, createWatchFields, createWatchAll } from '@schemx/core'
 *
 * // 监听单个字段
 * const dispose = createWatchField(form, 'username', (payload, snapshot) => {
 *   console.log(`${payload.path}: ${payload.prevValue} -> ${payload.value}`)
 * }, { immediate: true })
 *
 * // 监听多个字段
 * const dispose = createWatchFields(form, ['firstName', 'lastName'], (payload, snapshot) => {
 *   console.log('changed:', payload.changedValues)
 * }, {})
 *
 * // 监听所有字段
 * const dispose = createWatchAll(form, (payload, snapshot) => {
 *   console.log('changed paths:', payload.changedPaths)
 * }, {})
 *
 * // 取消监听
 * dispose()
 * ```
 */

import { isEqual } from "es-toolkit/compat"

import { diff } from "./utils/diff"
import { collectObjectPathsByLeaf } from "./utils/path"

import type { FormValues, NamePath, SchemxInstance, Value } from "./types"

/** 单字段订阅回调的载荷 */
type FieldPayload = {
  /** 变更后的字段值 */
  value: Value
  /** 变更前的字段值 */
  prevValue: Value
}

/** 多字段订阅回调的载荷 */
type FieldsPayload<T> = {
  /** 本次变更涉及的所有字段路径 */
  changedPaths: NamePath<T>[]
  /** 本次变更涉及的字段值（部分表单数据） */
  changedValues: Partial<T>
  /** 变更前对应字段的旧值（部分表单数据） */
  prevValues: Partial<T>
}

/** 全局订阅回调的载荷 */
type GlobalPayload<T> = {
  /** 本次变更涉及的所有字段路径 */
  changedPaths: NamePath<T>[]
  /** 本次变更涉及的字段值（部分表单数据） */
  changedValues: Partial<T>
  /** 变更前对应字段的旧值（部分表单数据） */
  prevValues: Partial<T>
}

/**
 * 订阅回调的基础类型。
 *
 * 回调接收两个参数：变更载荷（payload）和变更后的表单完整快照（latestSnapshot）。
 */
type BaseSubscribeCallback<T, P> = (payload: P, latestSnapshot: T) => void

/** 单字段订阅回调类型，监听指定字段的变更 */
export type WatchFieldCallback<T> = BaseSubscribeCallback<T, FieldPayload>

/** 多字段订阅回调类型，监听一组字段的变更 */
export type WatchFieldsCallback<T> = BaseSubscribeCallback<T, FieldsPayload<T>>

/** 全局订阅回调类型，监听表单中任意字段的变更 */
export type WatchAllCallback<T> = BaseSubscribeCallback<T, GlobalPayload<T>>

/**
 * useWatch / createWatch 选项
 */
export interface useWatchOptions {
  /**
   * 是否在创建后立即执行一次回调
   *
   * @default false
   */
  immediate?: boolean

  /**
   * 是否在新旧值深度相等时跳过回调
   *
   * 开启后，使用 `isEqual`（来自 es-toolkit）对新旧值进行深度比较，
   * 若相等则不触发回调，可减少不必要的执行。
   *
   * @default false
   */
  inequality?: boolean
}

/**
 * createWatch 系列函数的返回类型 - 取消监听函数
 *
 * 调用后将移除对应的 effect，不再接收后续变更通知。
 */
export type CreateWatchReturn = () => void

/**
 * 监听单个字段变化（基于 Signal effect）
 *
 * 在 effect 内调用 form.getFieldValue(name) 建立依赖追踪，
 * 当字段值变化时 effect 自动重新执行并触发回调。
 *
 * @param form - 表单实例
 * @param name - 要监听的字段路径
 * @param callback - 字段变化时的回调函数，接收 (payload, latestSnapshot)
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * const dispose = createWatchField(form, 'email', (payload, snapshot) => {
 *   console.log(`${payload.path}: ${payload.prevValue} -> ${payload.value}`)
 * }, { immediate: true, inequality: true })
 * dispose()
 * ```
 */
export const createWatchField = <T extends FormValues>(
  form: SchemxInstance<T>,
  name: NamePath<T>,
  callback: WatchFieldCallback<T>,
  options: useWatchOptions
): CreateWatchReturn => {
  let prev: Value = form.getFieldSnapshot(name)
  let isFirst = true

  const dispose = form.effect(() => {
    const current = form.getFieldValue(name)
    const latestSnapshot = form.getFieldsSnapshot()

    if (isFirst) {
      isFirst = false
      if (options.immediate) {
        callback({ value: current, prevValue: undefined }, latestSnapshot)
      }

      prev = current

      return
    }

    if (options.inequality && isEqual(current, prev)) return

    callback({ value: current, prevValue: prev }, latestSnapshot)

    prev = current
  })

  return dispose
}

/**
 * 监听多个字段变化（基于 Signal effect）
 *
 * 在 effect 内调用多个 form.getFieldValue 建立依赖追踪，
 * 当任一被监听字段变化时 effect 自动重新执行并触发回调。
 *
 * @param form - 表单实例
 * @param names - 要监听的字段路径数组
 * @param callback - 字段变化时的回调函数，接收 (payload, latestSnapshot)
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * const dispose = createWatchFields(form, ['firstName', 'lastName'], (payload, snapshot) => {
 *   console.log('changed:', payload.changedValues)
 *   console.log('prev:', payload.prevValues)
 * }, { inequality: true })
 * dispose()
 * ```
 */
export const createWatchFields = <T extends FormValues>(
  form: SchemxInstance<T>,
  names: NamePath<T>[],
  callback: WatchFieldsCallback<T>,
  options: useWatchOptions
): CreateWatchReturn => {
  let prevValues: Partial<T> = form.getFieldsSnapshot(names)
  let isFirst = true

  const dispose = form.effect(() => {
    const currentValues: Partial<T> = form.getFieldsValue(names)
    const latestSnapshot = form.getFieldsSnapshot()

    if (isFirst) {
      isFirst = false

      if (options.immediate) {
        callback(
          { changedPaths: names, changedValues: currentValues, prevValues: {} },
          latestSnapshot
        )
      }

      prevValues = { ...currentValues }

      return
    }

    if (options.inequality && isEqual(currentValues, prevValues)) return

    const changedValues = diff<Partial<T>>(currentValues, prevValues)
    const changedPaths = collectObjectPathsByLeaf<NamePath<T>>(changedValues)

    callback({ changedPaths, changedValues, prevValues }, latestSnapshot)

    prevValues = { ...currentValues }
  })

  return dispose
}

/**
 * 监听所有字段变化（基于 Signal effect）
 *
 * 在 effect 内调用 form.getFieldsValue() 建立依赖追踪，
 * 当任何字段变化时 effect 自动重新执行并触发回调。
 *
 * @param form - 表单实例
 * @param callback - 字段变化时的回调函数，接收 (payload, latestSnapshot)
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * const dispose = createWatchAll(form, (payload, snapshot) => {
 *   console.log('changed paths:', payload.changedPaths)
 *   console.log('changed values:', payload.changedValues)
 * }, { immediate: true })
 * dispose()
 * ```
 */
export const createWatchAll = <T extends FormValues>(
  form: SchemxInstance<T>,
  callback: WatchAllCallback<T>,
  options: useWatchOptions
): CreateWatchReturn => {
  let isFirst = true
  let prevValues: T = form.getFieldsSnapshot()

  const dispose = form.effect(() => {
    const latestSnapshot = form.getFieldsSnapshot()

    if (isFirst) {
      isFirst = false
      if (options.immediate) {
        callback(
          {
            changedPaths: [],
            changedValues: latestSnapshot,
            prevValues: {} as Partial<T>,
          },
          latestSnapshot
        )
      }

      prevValues = { ...latestSnapshot }

      return
    }

    if (options.inequality && isEqual(latestSnapshot, prevValues)) return

    const changedValues = diff<Partial<T>>(latestSnapshot, prevValues)
    const changedPaths = collectObjectPathsByLeaf<NamePath<T>>(changedValues)

    callback({ changedPaths, changedValues, prevValues }, latestSnapshot)

    prevValues = { ...latestSnapshot }
  })

  return dispose
}
