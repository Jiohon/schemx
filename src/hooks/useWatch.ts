/**
 * useWatch - 监听字段变化
 *
 * @module hooks/useWatch
 */

import { onUnmounted } from "vue"

import type { FormValues, SchemaFormInstance } from "@/types"

import { useFormContext } from "./useFormContext"

/**
 * 单字段监听回调
 */
export type SingleFieldCallback = (
  value: unknown,
  oldValue: unknown,
  name: string
) => void

/**
 * 多字段监听回调
 */
export type MultiFieldCallback = (values: FormValues, changedField: string) => void

/**
 * 全局监听回调
 */
export type GlobalCallback = (changedValues: FormValues, allValues: FormValues) => void

/**
 * useWatch 选项
 */
export interface UseWatchOptions {
  /** 是否立即执行回调 */
  immediate?: boolean
}

// ==================== 内部工具函数 ====================

/**
 * 创建取消订阅函数
 */
function createUnsubscriber(unsubscribes: Array<() => void>): () => void {
  return () => unsubscribes.forEach((fn) => fn())
}

/**
 * 获取多个字段的值
 */
function getFieldValues(formContext: SchemaFormInstance, names: string[]): FormValues {
  const values: FormValues = {}
  for (const name of names) {
    values[name] = formContext.getFieldValue(name)
  }

  return values
}

// ==================== 监听实现 ====================

/**
 * 监听所有字段变化
 */
function watchAll(
  formContext: SchemaFormInstance,
  callback: GlobalCallback,
  options: UseWatchOptions
): () => void {
  const unsubscribe = formContext.subscribeAll(callback)

  if (options.immediate) {
    const allValues = formContext.getFieldsValue()
    callback(allValues, allValues)
  }

  return unsubscribe
}

/**
 * 监听单个字段变化
 */
function watchField(
  formContext: SchemaFormInstance,
  name: string,
  callback: SingleFieldCallback,
  options: UseWatchOptions
): () => void {
  let oldValue = formContext.getFieldValue(name)

  const unsubscribe = formContext.subscribe(name, (_path, value) => {
    const prevValue = oldValue
    oldValue = value
    callback(value, prevValue, name)
  })

  if (options.immediate) {
    callback(formContext.getFieldValue(name), undefined, name)
  }

  return unsubscribe
}

/**
 * 监听多个字段变化
 */
function watchFields(
  formContext: SchemaFormInstance,
  names: string[],
  callback: MultiFieldCallback,
  options: UseWatchOptions
): () => void {
  const unsubscribes: Array<() => void> = []

  for (const name of names) {
    const unsubscribe = formContext.subscribe(name, () => {
      callback(getFieldValues(formContext, names), name)
    })
    unsubscribes.push(unsubscribe)
  }

  if (options.immediate) {
    callback(getFieldValues(formContext, names), names[0])
  }

  return createUnsubscriber(unsubscribes)
}

// ==================== 公开 API ====================

/**
 * 监听字段变化
 *
 * 支持三种使用方式：
 * 1. 监听单个字段：`useWatch('name', callback)`
 * 2. 监听多个字段：`useWatch(['name', 'age'], callback)`
 * 3. 监听所有字段：`useWatch(callback)`
 *
 * @example
 * ```ts
 * // 监听单个字段
 * useWatch('username', (value, oldValue, name) => {
 *   console.log(`${name} changed from ${oldValue} to ${value}`)
 * })
 *
 * // 监听多个字段
 * useWatch(['firstName', 'lastName'], (values, changedField) => {
 *   console.log(`${changedField} changed, current values:`, values)
 * })
 *
 * // 监听所有字段
 * useWatch((changedValues, allValues) => {
 *   console.log('Form changed:', changedValues)
 * })
 *
 * // 立即执行
 * useWatch('name', callback, { immediate: true })
 * ```
 */
export function useWatch(callback: GlobalCallback, options?: UseWatchOptions): () => void
export function useWatch(
  name: string,
  callback: SingleFieldCallback,
  options?: UseWatchOptions
): () => void
export function useWatch(
  names: string[],
  callback: MultiFieldCallback,
  options?: UseWatchOptions
): () => void
export function useWatch(
  nameOrNamesOrCallback: string | string[] | GlobalCallback,
  callbackOrOptions?: SingleFieldCallback | MultiFieldCallback | UseWatchOptions,
  maybeOptions?: UseWatchOptions
): () => void {
  const context = useFormContext()

  let unsubscribe: () => void

  // 全局监听：useWatch(callback, options?)
  if (typeof nameOrNamesOrCallback === "function") {
    unsubscribe = watchAll(
      context.form,
      nameOrNamesOrCallback,
      (callbackOrOptions as UseWatchOptions) || {}
    )
  }
  // 单字段监听：useWatch('name', callback, options?)
  else if (typeof nameOrNamesOrCallback === "string") {
    unsubscribe = watchField(
      context.form,
      nameOrNamesOrCallback,
      callbackOrOptions as SingleFieldCallback,
      maybeOptions || {}
    )
  }
  // 多字段监听：useWatch(['name', 'age'], callback, options?)
  else {
    unsubscribe = watchFields(
      context.form,
      nameOrNamesOrCallback,
      callbackOrOptions as MultiFieldCallback,
      maybeOptions || {}
    )
  }

  onUnmounted(unsubscribe)

  return unsubscribe
}

// ==================== 便捷方法 ====================

/**
 * 监听单个字段变化的便捷方法
 *
 * @example
 * ```ts
 * useWatchField('name', (value, oldValue) => {
 *   console.log('name changed:', value)
 * })
 * ```
 */
export function useWatchField(
  name: string,
  callback: (value: unknown, oldValue: unknown) => void,
  options?: UseWatchOptions
): () => void {
  return useWatch(name, (value, oldValue) => callback(value, oldValue), options)
}

/**
 * 监听多个字段变化的便捷方法
 *
 * @example
 * ```ts
 * useWatchFields(['firstName', 'lastName'], (values) => {
 *   console.log('name fields changed:', values)
 * })
 * ```
 */
export function useWatchFields(
  names: string[],
  callback: (values: FormValues) => void,
  options?: UseWatchOptions
): () => void {
  return useWatch(names, (values) => callback(values), options)
}

/**
 * 监听所有字段变化的便捷方法
 *
 * @example
 * ```ts
 * useWatchAll((changedValues, allValues) => {
 *   console.log('form changed:', changedValues)
 * })
 * ```
 */
export function useWatchAll(
  callback: GlobalCallback,
  options?: UseWatchOptions
): () => void {
  return useWatch(callback, options)
}

export default useWatch
