/**
 * useWatch - 监听字段变化（Vue 组合式 API 版本）
 *
 * 在组件内使用，自动通过 `useFormInstance` 获取 formContext，
 * 并在 `onUnmounted` 时自动取消监听，无需手动管理生命周期。
 * 纯函数版本请使用 `createWatch` 系列函数。
 *
 * 提供三种监听模式：
 * - 全局监听：`useWatch(callback, options?)` — 监听表单中任意字段变化
 * - 单字段监听：`useWatch(name, callback, options?)` — 监听指定字段变化
 * - 多字段监听：`useWatch(names, callback, options?)` — 监听一组字段变化
 *
 * 同时提供语义化的便捷方法：
 * - {@link useWatchField} — 单字段监听
 * - {@link useWatchFields} — 多字段监听
 * - {@link useWatchAll} — 全局监听
 *
 * @module hooks/useWatch
 *
 * @example
 * ```ts
 * // 全局监听
 * useWatch((snapshot) => {
 *   console.log('form changed:', snapshot)
 * })
 *
 * // 单字段监听
 * useWatch('username', (current, prev) => {
 *   console.log('username changed:', prev, '->', current)
 * }, { immediate: true })
 *
 * // 多字段监听
 * useWatch(['firstName', 'lastName'], (currentValues, prevValues) => {
 *   console.log('name changed:', currentValues)
 * }, { inequality: true })
 * ```
 */

import { onUnmounted } from "vue"

import { createWatchAll, createWatchField, createWatchFields } from "@schemx/core"

import { useFormInstance } from "../useForm"

import type { FormValues, NamePath } from "@schemx/core"
import type {
  useWatchOptions,
  WatchAllCallback,
  WatchFieldCallback,
  WatchFieldsCallback,
} from "@schemx/core"

/**
 * 监听所有字段变化
 *
 * @param callback - 全局变化回调，接收 `(latestSnapshot)`
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * useWatch((snapshot) => {
 *   console.log('form changed:', snapshot)
 * })
 * ```
 */
export function useWatch<T extends FormValues>(
  callback: WatchAllCallback<T>,
  options?: useWatchOptions
): () => void
/**
 * 监听单个字段变化
 *
 * @param name - 字段路径
 * @param callback - 单字段变化回调，接收 `(currentValue, prevValue)`
 * @param options - 监听选项
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * useWatch('name', (current, prev) => {
 *   console.log('name changed:', prev, '->', current)
 * }, { immediate: true })
 * ```
 */
export function useWatch<T extends FormValues>(
  name: NamePath<T>,
  callback: WatchFieldCallback<T>,
  options?: useWatchOptions
): () => void
/**
 * 监听多个字段变化
 *
 * @param names - 字段路径数组
 * @param callback - 多字段变化回调，接收 `(currentValues, prevValues)`
 * @param options - 监听选项
 *
 * @returns 取消监听函数
 *
 * @example
 * ```ts
 * useWatch(['firstName', 'lastName'], (currentValues, prevValues) => {
 *   console.log('changed:', currentValues)
 * }, { inequality: true })
 * ```
 */
export function useWatch<T extends FormValues>(
  names: NamePath<T>[],
  callback: WatchFieldsCallback<T>,
  options?: useWatchOptions
): () => void
/**
 * useWatch 实现 — 根据第一个参数类型分发到对应的 createWatch 函数
 *
 * @param nameOrNamesOrCallback - 字段路径、字段路径数组或全局回调
 * @param callbackOrOptions - 回调函数或全局监听时的选项
 * @param maybeOptions - 单字段/多字段监听时的选项
 * @returns 取消监听函数
 */
export function useWatch<T extends FormValues>(
  nameOrNamesOrCallback: NamePath<T> | NamePath<T>[] | WatchAllCallback<T>,
  callbackOrOptions?: WatchFieldCallback<T> | WatchFieldsCallback<T> | useWatchOptions,
  maybeOptions?: useWatchOptions
): () => void {
  const form = useFormInstance()

  let dispose: () => void

  // 全局监听：useWatch(callback, options?)
  if (typeof nameOrNamesOrCallback === "function") {
    dispose = createWatchAll(
      form,
      nameOrNamesOrCallback as WatchAllCallback<FormValues>,
      (callbackOrOptions as useWatchOptions) || {}
    )
  }
  // 单字段监听：useWatch(name, callback, options?)
  else if (
    typeof nameOrNamesOrCallback === "string" ||
    typeof nameOrNamesOrCallback === "number"
  ) {
    dispose = createWatchField(
      form,
      nameOrNamesOrCallback as NamePath,
      callbackOrOptions as WatchFieldCallback<FormValues>,
      maybeOptions || {}
    )
  }
  // 多字段监听：useWatch(names, callback, options?)
  else {
    dispose = createWatchFields(
      form,
      nameOrNamesOrCallback as NamePath[],
      callbackOrOptions as WatchFieldsCallback<FormValues>,
      maybeOptions || {}
    )
  }

  onUnmounted(dispose)

  return dispose
}

/**
 * 监听单个字段变化的便捷方法
 *
 * 等价于 `useWatch(name, callback, options)`，语义更明确。
 * 自动绑定 formContext 并在组件卸载时取消监听。
 *
 * @param name - 要监听的字段路径，如 `'username'` 或 `'user.address.city'`
 * @param callback - 字段变化回调，接收 `(currentValue, prevValue)`
 * @param options - 可选配置
 *   - `immediate` - 是否立即执行一次回调（默认 `false`）
 *   - `inequality` - 是否在新旧值相等时跳过回调（默认 `false`）
 * @returns 取消监听函数（通常无需手动调用，组件卸载时自动取消）
 *
 * @example
 * ```ts
 * useWatchField('name', (current, prev) => {
 *   console.log('name changed from', prev, 'to', current)
 * })
 *
 * // 立即执行
 * useWatchField('name', callback, { immediate: true })
 *
 * // 值相等时跳过
 * useWatchField('name', callback, { inequality: true })
 * ```
 */
export function useWatchField<T extends FormValues = FormValues>(
  name: NamePath<T>,
  callback: WatchFieldCallback<T>,
  options?: useWatchOptions
): () => void {
  return useWatch<T>(name, callback, options)
}

/**
 * 监听多个字段变化的便捷方法
 *
 * 等价于 `useWatch(names, callback, options)`，语义更明确。
 * 当任一指定字段发生变化时触发回调，自动绑定 formContext 并在组件卸载时取消监听。
 *
 * @param names - 要监听的字段路径数组，如 `['firstName', 'lastName']`
 * @param callback - 字段变化回调，接收 `(currentValues, prevValues)`
 *   - `currentValues` - 所有被监听字段的当前值 `Record<string, Value>`
 *   - `prevValues` - 所有被监听字段的上一次值 `Record<string, Value>`
 * @param options - 可选配置
 *   - `immediate` - 是否立即执行一次回调（默认 `false`）
 *   - `inequality` - 是否在新旧值相等时跳过回调（默认 `false`）
 * @returns 取消监听函数（通常无需手动调用，组件卸载时自动取消）
 *
 * @example
 * ```ts
 * useWatchFields(
 *   ['firstName', 'lastName'],
 *   (currentValues, prevValues) => {
 *     console.log('name fields changed:', currentValues)
 *     console.log('previous values:', prevValues)
 *   }
 * )
 *
 * // 立即执行
 * useWatchFields(['firstName', 'lastName'], callback, { immediate: true })
 * ```
 */
export function useWatchFields<T extends FormValues>(
  names: NamePath<T>[],
  callback: WatchFieldsCallback<T>,
  options?: useWatchOptions
): () => void {
  return useWatch<T>(names, callback, options)
}

/**
 * 监听所有字段变化的便捷方法
 *
 * 等价于 `useWatch(callback, options)`，语义更明确。
 * 当表单中任意字段发生变化时触发回调，
 * 适用于全局感知表单变化的场景（如自动保存、脏检测）。
 * 自动绑定 formContext 并在组件卸载时取消监听。
 *
 * @param callback - 全局变化回调，接收 `(latestSnapshot)`
 * @param options - 可选配置
 *   - `immediate` - 是否立即执行一次回调（默认 `false`）
 *   - `inequality` - 是否在新旧值相等时跳过回调（默认 `false`）
 * @returns 取消监听函数（通常无需手动调用，组件卸载时自动取消）
 *
 * @example
 * ```ts
 * useWatchAll((snapshot) => {
 *   console.log('form changed:', snapshot)
 * })
 *
 * // 立即执行
 * useWatchAll(callback, { immediate: true })
 * ```
 */
export function useWatchAll<T extends FormValues = FormValues>(
  callback: WatchAllCallback<T>,
  options?: useWatchOptions
): () => void {
  return useWatch(callback, options)
}

export default useWatch
