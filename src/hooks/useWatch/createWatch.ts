/**
 * createWatch - 纯函数版本的字段监听工具
 *
 * 提供不依赖 Vue 组件生命周期的字段监听能力，适用于非组件场景（如工具函数、外部逻辑）。
 * 组件内推荐使用 `useWatch`（自动绑定 form 并在 onUnmounted 时取消订阅）。
 *
 * @module utils/createWatch
 *
 * @example
 * ```ts
 * import { createWatchField, createWatchFields, createWatchAll } from '@/utils/createWatch'
 *
 * // 监听单个字段
 * const unsubscribe = createWatchField(form, 'username', (payload, prev, latest) => {
 *   console.log(`username: ${payload.prevValue} -> ${payload.value}`)
 * }, { immediate: true })
 *
 * // 监听多个字段
 * const unsubscribe = createWatchFields(form, ['firstName', 'lastName'], (payload, prev, latest) => {
 *   console.log('changed:', payload.changedValues)
 * }, {})
 *
 * // 监听所有字段
 * const unsubscribe = createWatchAll(form, (payload, prev, latest) => {
 *   console.log('paths:', payload.changedPaths)
 * }, {})
 *
 * // 取消订阅
 * unsubscribe()
 * ```
 */

import { isEqual } from "es-toolkit"

import type { FormValues, NamePath } from "@/types"

import {
  FieldsSubscribeCallback,
  FieldSubscribeCallback,
  GlobalSubscribeCallback,
} from "../../core/subscriber"
import { SchemaFormInstance } from "../../types/instance"
import { pickByPaths } from "@/utils"

/**
 * 单字段监听回调
 *
 * @typeParam T - 表单值类型，默认为 {@link FormValues}
 *
 * @see {@link FieldSubscribeCallback} 底层回调类型
 */
export type SingleFieldCallback<T extends FormValues = FormValues> =
  FieldSubscribeCallback<T>

/**
 * 多字段监听回调
 *
 * @typeParam T - 表单值类型，默认为 {@link FormValues}
 *
 * @see {@link FieldsSubscribeCallback} 底层回调类型
 */
export type MultiFieldCallback<T extends FormValues = FormValues> =
  FieldsSubscribeCallback<T>

/**
 * 全局监听回调
 *
 * @typeParam T - 表单值类型，默认为 {@link FormValues}
 *
 * @see {@link GlobalSubscribeCallback} 底层回调类型
 */
export type GlobalCallback<T extends FormValues = FormValues> = GlobalSubscribeCallback<T>

/**
 * useWatch / createWatch 选项
 */
export interface UseWatchOptions {
  /**
   * 是否在订阅后立即执行一次回调
   *
   * 立即执行时，回调接收的 payload 中 `value` / `prevValue`（单字段）
   * 或 `changedValues` / `prevValues`（多字段/全局）均为 `undefined` / 空对象，
   * `latestSnapshot` 为当前表单快照。
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
 * createWatch 系列函数的返回类型 —— 取消订阅函数
 *
 * 调用后将移除对应的订阅，不再接收后续变更通知。
 */
export type CreateWatchReturn = () => void

/**
 * 监听单个字段变化（纯函数版本）
 *
 * 订阅指定字段的值变更，当字段值（或其父/子路径）发生变化时触发回调。
 * 支持 `immediate`（立即执行）和 `inequality`（值相等时跳过）选项。
 *
 * @param form - 表单实例，通过 `useForm` 或 `createForm` 获取
 * @param name - 要监听的字段路径，如 `'username'` 或 `'user.address.city'`
 * @param callback - 字段变化时的回调函数，接收 `(payload, prevSnapshot, latestSnapshot)`
 *   - `payload.path` - 发生变更的字段路径
 *   - `payload.value` - 变更后的字段值
 *   - `payload.prevValue` - 变更前的字段值
 *   - `prevSnapshot` - 变更前的表单完整快照
 *   - `latestSnapshot` - 变更后的表单最新快照
 * @param options - 监听选项
 * @returns 取消订阅函数，调用后停止监听
 *
 * @example
 * ```ts
 * const unsubscribe = createWatchField(form, 'email', (payload, prevSnapshot, latestSnapshot) => {
 *   console.log(`email changed: ${payload.prevValue} -> ${payload.value}`)
 *   console.log('current form snapshot:', latestSnapshot)
 * }, { immediate: true, inequality: true })
 *
 * // 不再需要时取消订阅
 * unsubscribe()
 * ```
 */
export const createWatchField = (
  form: SchemaFormInstance,
  name: NamePath,
  callback: SingleFieldCallback,
  options: UseWatchOptions
): CreateWatchReturn => {
  const unsubscribe = form.subscribe(name, (payload, prevSnapshot, latestSnapshot) => {
    if (options.inequality && isEqual(payload.value, payload.prevValue)) return

    callback(payload, prevSnapshot, latestSnapshot)
  })

  if (options.immediate) {
    const payload = { path: name, value: undefined, prevValue: undefined }

    callback(payload, {}, form.getFieldsSnapshot())
  }

  return unsubscribe
}

/**
 * 监听多个字段变化（纯函数版本）
 *
 * 订阅一组字段的值变更，当任一指定字段发生变化时触发回调。
 * 聚合快照逻辑由 `form.subscribeFields` 处理，
 * 此处只负责 `immediate` 和 `inequality` 选项。
 *
 * @param form - 表单实例，通过 `useForm` 或 `createForm` 获取
 * @param names - 要监听的字段路径数组，如 `['firstName', 'lastName']`
 * @param callback - 字段变化时的回调函数，接收 `(payload, prevSnapshot, latestSnapshot)`
 *   - `payload.changedValues` - 本次变更涉及的字段值（部分表单数据）
 *   - `prevSnapshot` - 变更前的表单完整快照
 *   - `latestSnapshot` - 变更后的表单最新快照
 * @param options - 监听选项
 * @returns 取消订阅函数，调用后停止监听
 *
 * @example
 * ```ts
 * const unsubscribe = createWatchFields(
 *   form,
 *   ['firstName', 'lastName'],
 *   (payload, prevSnapshot, latestSnapshot) => {
 *     console.log('changed:', payload.changedValues)
 *   },
 *   { inequality: true }
 * )
 *
 * // 不再需要时取消订阅
 * unsubscribe()
 * ```
 */
export const createWatchFields = (
  form: SchemaFormInstance,
  names: NamePath[],
  callback: MultiFieldCallback,
  options: UseWatchOptions
): CreateWatchReturn => {
  const unsubscribe = form.subscribeFields(
    names,
    (payload, prevSnapshot, latestSnapshot) => {
      if (options.inequality && isEqual(payload.changedValues, payload.prevValues)) return

      callback(payload, prevSnapshot, latestSnapshot)
    }
  )

  if (options.immediate) {
    const payload = { changedValues: {}, prevValues: {} }

    callback(payload, {}, form.getFieldsSnapshot())
  }

  return unsubscribe
}

/**
 * 监听所有字段变化（纯函数版本）
 *
 * 订阅表单中任意字段的值变更，当任何字段发生变化时触发回调。
 * 适用于需要全局感知表单变化的场景，如自动保存、表单脏检测等。
 *
 * @param form - 表单实例，通过 `useForm` 或 `createForm` 获取
 * @param callback - 字段变化时的回调函数，接收 `(payload, prevSnapshot, latestSnapshot)`
 *   - `payload.changedPaths` - 本次变更涉及的所有字段路径
 *   - `payload.changedValues` - 本次变更涉及的字段值（部分表单数据）
 *   - `payload.prevValues` - 变更前对应字段的旧值（部分表单数据）
 *   - `prevSnapshot` - 变更前的表单完整快照
 *   - `latestSnapshot` - 变更后的表单最新快照
 * @param options - 监听选项
 * @returns 取消订阅函数，调用后停止监听
 *
 * @example
 * ```ts
 * const unsubscribe = createWatchAll(form, (payload, prevSnapshot, latestSnapshot) => {
 *   console.log('changed paths:', payload.changedPaths)
 *   console.log('changed values:', payload.changedValues)
 *   console.log('previous values:', payload.prevValues)
 * }, { immediate: true })
 *
 * // 不再需要时取消订阅
 * unsubscribe()
 * ```
 */
export const createWatchAll = (
  form: SchemaFormInstance,
  callback: GlobalCallback,
  options: UseWatchOptions
): CreateWatchReturn => {
  const unsubscribe = form.subscribeAll((payload, prevSnapshot, latestSnapshot) => {
    const prevValues = pickByPaths(prevSnapshot, new Set([...payload.changedPaths]))

    if (options.inequality && isEqual(payload.changedValues, prevValues)) return

    callback(payload, prevSnapshot, latestSnapshot)
  })

  if (options.immediate) {
    const payload = { changedPaths: [], changedValues: {}, prevValues: {} }

    callback(payload, {}, form.getFieldsSnapshot)
  }

  return unsubscribe
}
