/**
 * useSchemaWatch - 监听字段变化（Vue 组合式 API 版本）
 *
 * 在组件内使用，自动通过 `useFormInstance` 获取 formContext，
 * 并在 `onUnmounted` 时自动取消订阅，无需手动管理生命周期。
 * 纯函数版本请使用 `createWatch` 系列函数。
 *
 * 提供三种监听模式：
 * - 全局监听：`useSchemaWatch(callback, options?)` — 监听表单中任意字段变化
 * - 单字段监听：`useSchemaWatch(name, callback, options?)` — 监听指定字段变化
 * - 多字段监听：`useSchemaWatch(names, callback, options?)` — 监听一组字段变化
 *
 * 同时提供语义化的便捷方法：
 * - {@link useSchemaWatchField} — 单字段监听
 * - {@link useSchemaWatchFields} — 多字段监听
 * - {@link useSchemaWatchAll} — 全局监听
 *
 * @module hooks/useSchemaWatch
 *
 * @example
 * ```ts
 * // 全局监听
 * useSchemaWatch((payload, prev, latest) => {
 *   console.log('changed paths:', payload.changedPaths)
 * })
 *
 * // 单字段监听
 * useSchemaWatch('username', (payload, prev, latest) => {
 *   console.log('username changed:', payload.value)
 * }, { immediate: true })
 *
 * // 多字段监听
 * useSchemaWatch(['firstName', 'lastName'], (payload, prev, latest) => {
 *   console.log('name changed:', payload.changedValues)
 * }, { inequality: true })
 * ```
 */

import { onUnmounted } from "vue"

import type { NamePath } from "@/types"

import { useFormInstance } from "../useForm"

import {
  createWatchAll,
  createWatchField,
  createWatchFields,
  type GlobalCallback,
  type MultiFieldCallback,
  type SingleFieldCallback,
  type useSchemaWatchOptions,
} from "./createWatch"

/**
 * 监听所有字段变化
 *
 * @param callback - 全局变化回调
 * @param options - 监听选项
 * @returns 取消订阅函数
 *
 * @example
 * ```ts
 * useSchemaWatch((payload, prev, latest) => {
 *   console.log('form changed:', payload.changedPaths)
 * })
 * ```
 */
export function useSchemaWatch(
  callback: GlobalCallback,
  options?: useSchemaWatchOptions
): () => void
/**
 * 监听单个字段变化
 *
 * @param name - 字段路径
 * @param callback - 单字段变化回调
 * @param options - 监听选项
 * @returns 取消订阅函数
 *
 * @example
 * ```ts
 * useSchemaWatch('name', (payload, prev, latest) => {
 *   console.log('name changed:', payload.value)
 * }, { immediate: true })
 * ```
 */
export function useSchemaWatch(
  name: NamePath,
  callback: SingleFieldCallback,
  options?: useSchemaWatchOptions
): () => void
/**
 * 监听多个字段变化
 *
 * @param names - 字段路径数组
 * @param callback - 多字段变化回调
 * @param options - 监听选项
 *
 * @returns 取消订阅函数
 *
 * @example
 * ```ts
 * useSchemaWatch(['firstName', 'lastName'], (payload, prev, latest) => {
 *   console.log('changed:', payload.changedValues)
 * }, { inequality: true })
 * ```
 */
export function useSchemaWatch(
  names: NamePath[],
  callback: MultiFieldCallback,
  options?: useSchemaWatchOptions
): () => void
/**
 * useSchemaWatch 实现 — 根据第一个参数类型分发到对应的 createWatch 函数
 *
 * @param nameOrNamesOrCallback - 字段路径、字段路径数组或全局回调
 * @param callbackOrOptions - 回调函数或全局监听时的选项
 * @param maybeOptions - 单字段/多字段监听时的选项
 * @returns 取消订阅函数
 */
export function useSchemaWatch(
  nameOrNamesOrCallback: NamePath | NamePath[] | GlobalCallback,
  callbackOrOptions?: SingleFieldCallback | MultiFieldCallback | useSchemaWatchOptions,
  maybeOptions?: useSchemaWatchOptions
): () => void {
  const form = useFormInstance()

  let unsubscribe: () => void

  // 全局监听：useSchemaWatch(callback, options?)
  if (typeof nameOrNamesOrCallback === "function") {
    unsubscribe = createWatchAll(
      form,
      nameOrNamesOrCallback as GlobalCallback,
      (callbackOrOptions as useSchemaWatchOptions) || {}
    )
  }
  // 单字段监听：useSchemaWatch(name, callback, options?)
  else if (
    typeof nameOrNamesOrCallback === "string" ||
    typeof nameOrNamesOrCallback === "number"
  ) {
    unsubscribe = createWatchField(
      form,
      nameOrNamesOrCallback,
      callbackOrOptions as SingleFieldCallback,
      maybeOptions || {}
    )
  }
  // 多字段监听：useSchemaWatch(names, callback, options?)
  else {
    unsubscribe = createWatchFields(
      form,
      nameOrNamesOrCallback as NamePath[],
      callbackOrOptions as MultiFieldCallback,
      maybeOptions || {}
    )
  }

  onUnmounted(unsubscribe)

  return unsubscribe
}

/**
 * 监听单个字段变化的便捷方法
 *
 * 等价于 `useSchemaWatch(name, callback, options)`，语义更明确。
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
 * useSchemaWatchField('name', (payload, prevSnapshot, latestSnapshot) => {
 *   console.log('name changed from', payload.prevValue, 'to', payload.value)
 * })
 *
 * // 立即执行
 * useSchemaWatchField('name', callback, { immediate: true })
 *
 * // 值相等时跳过
 * useSchemaWatchField('name', callback, { inequality: true })
 * ```
 */
export function useSchemaWatchField(
  name: NamePath,
  callback: SingleFieldCallback,
  options?: useSchemaWatchOptions
): () => void {
  return useSchemaWatch(name, callback, options)
}

/**
 * 监听多个字段变化的便捷方法
 *
 * 等价于 `useSchemaWatch(names, callback, options)`，语义更明确。
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
 * useSchemaWatchFields(
 *   ['firstName', 'lastName'],
 *   (payload, prevSnapshot, latestSnapshot) => {
 *     console.log('name fields changed:', payload.changedValues)
 *     console.log('previous values:', payload.prevValues)
 *   }
 * )
 *
 * // 立即执行
 * useSchemaWatchFields(['firstName', 'lastName'], callback, { immediate: true })
 * ```
 */
export function useSchemaWatchFields(
  names: NamePath[],
  callback: MultiFieldCallback,
  options?: useSchemaWatchOptions
): () => void {
  return useSchemaWatch(names, callback, options)
}

/**
 * 监听所有字段变化的便捷方法
 *
 * 等价于 `useSchemaWatch(callback, options)`，语义更明确。
 * 当表单中任意字段发生变化时触发回调，
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
 * useSchemaWatchAll((payload, prevSnapshot, latestSnapshot) => {
 *   console.log('form changed:', payload.changedPaths)
 *   console.log('changed values:', payload.changedValues)
 * })
 *
 * // 立即执行
 * useSchemaWatchAll(callback, { immediate: true })
 * ```
 */
export function useSchemaWatchAll(
  callback: GlobalCallback,
  options?: useSchemaWatchOptions
): () => void {
  return useSchemaWatch(callback, options)
}

export default useSchemaWatch
