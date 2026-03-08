/**
 * useWatch - 监听字段变化（Vue 组合式 API 版本）
 *
 * 在组件内使用，自动通过 `useFormInstance` 获取 formContext，
 * 并在 `onUnmounted` 时自动取消订阅，无需手动管理生命周期。
 * 纯函数版本请使用 `@/utils/createWatch`。
 *
 * @module hooks/useWatch
 *
 * @example
 * ```ts
 * import { useWatch, useWatchField, useWatchFields, useWatchAll } from '@/hooks/useWatch'
 *
 * // 监听单个字段
 * useWatch((payload, prev, latest) => {
 *   console.log(`${payload.path}: ${payload.prevValue} -> ${payload.value}`)
 * }, 'username')
 *
 * // 监听多个字段
 * useWatch((payload, prev, latest) => {
 *   console.log('changed:', payload.changedValues)
 * }, ['firstName', 'lastName'])
 *
 * // 监听所有字段
 * useWatch((payload, prev, latest) => {
 *   console.log('form changed:', payload.changedPaths)
 * })
 * ```
 */

import { onUnmounted } from "vue"

import type { NamePath } from "@/types"

import { useFormInstance } from "../useFormContext"

import {
  createWatchAll,
  createWatchField,
  createWatchFields,
  type GlobalCallback,
  type MultiFieldCallback,
  type SingleFieldCallback,
  type UseWatchOptions,
} from "./createWatch"

// 重新导出类型，保持对外 API 不变
export type { SingleFieldCallback, MultiFieldCallback, GlobalCallback, UseWatchOptions }

/**
 * 监听字段变化（Vue 组合式 API）
 *
 * 支持三种使用方式，根据参数自动推断监听模式：
 *
 * 1. 监听单个字段：`useWatch(callback, 'name', options?)`
 * 2. 监听多个字段：`useWatch(callback, ['name', 'age'], options?)`
 * 3. 监听所有字段：`useWatch(callback, options?)`
 *
 * 自动绑定当前组件的 formContext（通过 `useFormInstance`），
 * 并在组件卸载时自动取消订阅。
 *
 * @param callback - 变化回调，签名取决于监听模式：
 *   - 单字段：`(payload: { path, value, prevValue }, prevSnapshot, latestSnapshot) => void`
 *   - 多字段：`(payload: { changedValues, prevValues }, prevSnapshot, latestSnapshot) => void`
 *   - 全局：`(payload: { changedPaths, changedValues, prevValues }, prevSnapshot, latestSnapshot) => void`
 * @param nameOrNames - 监听的字段名或字段名数组，不传则监听所有字段
 * @param options - 可选配置
 *   - `immediate` - 是否立即执行一次回调（默认 `false`）
 *   - `inequality` - 是否在新旧值相等时跳过回调（默认 `false`）
 * @returns 取消订阅函数（通常无需手动调用，组件卸载时自动取消）
 *
 * @example
 * ```ts
 * // 监听单个字段
 * useWatch(
 *   (payload, prevSnapshot, latestSnapshot) => {
 *     console.log('new:', payload.value, 'old:', payload.prevValue)
 *   },
 *   'username'
 * )
 *
 * // 监听多个字段
 * useWatch(
 *   (payload, prevSnapshot, latestSnapshot) => {
 *     console.log('changed values:', payload.changedValues)
 *   },
 *   ['firstName', 'lastName']
 * )
 *
 * // 监听所有字段
 * useWatch(
 *   (payload, prevSnapshot, latestSnapshot) => {
 *     console.log('form changed:', payload.changedPaths)
 *   }
 * )
 *
 * // 立即执行 + 值相等时跳过
 * useWatch(callback, 'name', { immediate: true, inequality: true })
 * ```
 */
export function useWatch(callback: GlobalCallback, options?: UseWatchOptions): () => void
export function useWatch(
  callback: SingleFieldCallback,
  name: NamePath,
  options?: UseWatchOptions
): () => void
export function useWatch(
  callback: MultiFieldCallback,
  names: NamePath[],
  options?: UseWatchOptions
): () => void
export function useWatch(
  callback: SingleFieldCallback | MultiFieldCallback | GlobalCallback,
  nameOrNamesOrOptions?: NamePath | NamePath[] | UseWatchOptions,
  maybeOptions?: UseWatchOptions
): () => void {
  const form = useFormInstance()

  let unsubscribe: () => void

  // 全局监听：useWatch(callback, options?)
  if (
    nameOrNamesOrOptions === undefined ||
    (typeof nameOrNamesOrOptions === "object" && !Array.isArray(nameOrNamesOrOptions))
  ) {
    unsubscribe = createWatchAll(
      form,
      callback as GlobalCallback,
      (nameOrNamesOrOptions as UseWatchOptions) || {}
    )
  }
  // 单字段监听：useWatch(callback, 'name', options?)
  else if (typeof nameOrNamesOrOptions === "string") {
    unsubscribe = createWatchField(
      form,
      nameOrNamesOrOptions,
      callback as SingleFieldCallback,
      maybeOptions || {}
    )
  }
  // 多字段监听：useWatch(callback, ['name', 'age'], options?)
  else {
    unsubscribe = createWatchFields(
      form,
      nameOrNamesOrOptions,
      callback as MultiFieldCallback,
      maybeOptions || {}
    )
  }

  onUnmounted(unsubscribe)

  return unsubscribe
}

/**
 * 监听单个字段变化的便捷方法
 *
 * 等价于 `useWatch(callback, name, options)`，参数顺序更符合「先指定目标，再传回调」的直觉。
 * 自动绑定 formContext 并在组件卸载时取消订阅。
 *
 * @param name - 要监听的字段路径，如 `'username'` 或 `'user.address.city'`
 * @param callback - 字段变化回调，接收 `(payload, prevSnapshot, latestSnapshot)`
 *   - `payload.path` - 发生变更的字段路径
 *   - `payload.value` - 变更后的字段值
 *   - `payload.prevValue` - 变更前的字段值
 * @param options - 可选配置
 *   - `immediate` - 是否立即执行一次回调（默认 `false`）
 *   - `inequality` - 是否在新旧值相等时跳过回调（默认 `false`）
 * @returns 取消订阅函数（通常无需手动调用，组件卸载时自动取消）
 *
 * @example
 * ```ts
 * useWatchField('name', (payload, prevSnapshot, latestSnapshot) => {
 *   console.log('name changed from', payload.prevValue, 'to', payload.value)
 * })
 *
 * // 立即执行
 * useWatchField('name', callback, { immediate: true })
 *
 * // 值相等时跳过
 * useWatchField('name', callback, { inequality: true })
 * ```
 */
export function useWatchField(
  name: NamePath,
  callback: SingleFieldCallback,
  options?: UseWatchOptions
): () => void {
  return useWatch(callback, name, options)
}

/**
 * 监听多个字段变化的便捷方法
 *
 * 等价于 `useWatch(callback, names, options)`，参数顺序更符合「先指定目标，再传回调」的直觉。
 * 当任一指定字段发生变化时触发回调，自动绑定 formContext 并在组件卸载时取消订阅。
 *
 * @param names - 要监听的字段路径数组，如 `['firstName', 'lastName']`
 * @param callback - 字段变化回调，接收 `(payload, prevSnapshot, latestSnapshot)`
 *   - `payload.changedValues` - 本次变更涉及的字段值（部分表单数据）
 *   - `payload.prevValues` - 变更前对应字段的旧值（部分表单数据）
 * @param options - 可选配置
 *   - `immediate` - 是否立即执行一次回调（默认 `false`）
 *   - `inequality` - 是否在新旧值相等时跳过回调（默认 `false`）
 * @returns 取消订阅函数（通常无需手动调用，组件卸载时自动取消）
 *
 * @example
 * ```ts
 * useWatchFields(
 *   ['firstName', 'lastName'],
 *   (payload, prevSnapshot, latestSnapshot) => {
 *     console.log('name fields changed:', payload.changedValues)
 *     console.log('previous values:', payload.prevValues)
 *   }
 * )
 *
 * // 立即执行
 * useWatchFields(['firstName', 'lastName'], callback, { immediate: true })
 * ```
 */
export function useWatchFields(
  names: NamePath[],
  callback: MultiFieldCallback,
  options?: UseWatchOptions
): () => void {
  return useWatch(callback, names, options)
}

/**
 * 监听所有字段变化的便捷方法
 *
 * 等价于 `useWatch(callback, options)`。当表单中任意字段发生变化时触发回调，
 * 适用于全局感知表单变化的场景（如自动保存、脏检测）。
 * 自动绑定 formContext 并在组件卸载时取消订阅。
 *
 * @param callback - 全局变化回调，接收 `(payload, prevSnapshot, latestSnapshot)`
 *   - `payload.changedPaths` - 本次变更涉及的所有字段路径
 *   - `payload.changedValues` - 本次变更涉及的字段值（部分表单数据）
 *   - `payload.prevValues` - 变更前对应字段的旧值（部分表单数据）
 * @param options - 可选配置
 *   - `immediate` - 是否立即执行一次回调（默认 `false`）
 *   - `inequality` - 是否在新旧值相等时跳过回调（默认 `false`）
 * @returns 取消订阅函数（通常无需手动调用，组件卸载时自动取消）
 *
 * @example
 * ```ts
 * useWatchAll((payload, prevSnapshot, latestSnapshot) => {
 *   console.log('form changed:', payload.changedPaths)
 *   console.log('changed values:', payload.changedValues)
 * })
 *
 * // 立即执行
 * useWatchAll(callback, { immediate: true })
 * ```
 */
export function useWatchAll(
  callback: GlobalCallback,
  options?: UseWatchOptions
): () => void {
  return useWatch(callback, options)
}

export default useWatch
