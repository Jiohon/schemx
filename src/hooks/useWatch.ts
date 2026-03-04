/**
 * useWatch - 监听字段变化
 *
 * @module hooks/useWatch
 */

import { DeepReadonly, onUnmounted } from "vue"

import { isEqual } from "es-toolkit"

import type { FormValues, NamePath, SchemaFormInstance, Value } from "@/types"

import { useFormInstance } from "./useFormContext"

/**
 * 单字段监听回调
 */
export type SingleFieldCallback<T extends FormValues = FormValues> = (
  value: Value,
  prevValue: Value,
  latestValues: DeepReadonly<T>
) => void

/**
 * 多字段监听回调
 */
export type MultiFieldCallback<T extends FormValues = FormValues> = (
  values: DeepReadonly<Partial<T>>,
  prevValues: DeepReadonly<Partial<T>>,
  latestValues: DeepReadonly<T>
) => void

/**
 * 全局监听回调
 */
export type GlobalCallback<T extends FormValues = FormValues> = (
  changedValues: DeepReadonly<Partial<T>>,
  prevValues: DeepReadonly<Partial<T>>,
  latestValues: DeepReadonly<T>
) => void

/**
 * useWatch 选项
 */
export interface UseWatchOptions {
  /** 是否立即执行回调 */
  immediate?: boolean
  /** 是否值变化时执行回调 */
  inequality?: boolean
}

/**
 * 监听单个字段变化
 */
function watchField(
  formContext: SchemaFormInstance,
  name: NamePath,
  callback: SingleFieldCallback,
  options: UseWatchOptions
): () => void {
  const unsubscribe = formContext.subscribe(
    name,
    (_path, value, prevValue, latestValues) => {
      if (options.inequality && isEqual(value, prevValue)) return

      callback(value, prevValue, latestValues)
    }
  )

  if (options.immediate) {
    const latestValues = formContext.getFieldsValue()

    callback(formContext.getFieldValue(name), undefined, latestValues)
  }

  return unsubscribe
}

/**
 * 监听多个字段变化
 */
function watchFields(
  formContext: SchemaFormInstance,
  names: NamePath[],
  callback: MultiFieldCallback,
  options: UseWatchOptions
): () => void {
  const unsubscribes: Array<() => void> = []

  for (const name of names) {
    const unsubscribe = formContext.subscribe(
      name,
      (_path, value, prevValue, latestValues) => {
        callback(value, prevValue, latestValues)
      }
    )
    unsubscribes.push(unsubscribe)
  }

  if (options.immediate) {
    const currentValues = formContext.getFieldsValue(names)
    const latestValues = formContext.getFieldsValue()
    callback(currentValues, {}, latestValues)
  }

  return () => unsubscribes.forEach((fn) => fn())
}

/**
 * 监听所有字段变化
 */
function watchAll(
  formContext: SchemaFormInstance,
  callback: GlobalCallback,
  options: UseWatchOptions
): () => void {
  const unsubscribe = formContext.subscribeAll(
    (changedValues, prevValues, latestValues, _changedPaths) => {
      if (options.inequality) {
        if (isEqual(changedValues, prevValues)) return
      }

      callback(changedValues, prevValues, latestValues)
    }
  )

  if (options.immediate) {
    const latestValues = formContext.getFieldsValue()

    callback(latestValues, {}, latestValues)
  }

  return unsubscribe
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
 * useWatch('username', (value, prevValue, name) => {
 *   console.log(`${name} changed from ${prevValue} to ${value}`)
 * })
 *
 * // 监听多个字段
 * useWatch(['firstName', 'lastName'], (values, changedField) => {
 *   console.log(`${changedField} changed, current values:`, values)
 * })
 *
 * // 监听所有字段
 * useWatch((changedValues, latestValues) => {
 *   console.log('Form changed:', changedValues)
 * })
 *
 * // 立即执行
 * useWatch('name', callback, { immediate: true })
 * ```
 */
export function useWatch(callback: GlobalCallback, options?: UseWatchOptions): () => void
export function useWatch(
  name: NamePath,
  callback: SingleFieldCallback,
  options?: UseWatchOptions
): () => void
export function useWatch(
  names: NamePath[],
  callback: MultiFieldCallback,
  options?: UseWatchOptions
): () => void
export function useWatch(
  nameOrNamesOrCallback: NamePath | NamePath[] | GlobalCallback,
  callbackOrOptions?: SingleFieldCallback | MultiFieldCallback | UseWatchOptions,
  maybeOptions?: UseWatchOptions
): () => void {
  const form = useFormInstance()

  let unsubscribe: () => void

  // 全局监听：useWatch(callback, options?)
  if (typeof nameOrNamesOrCallback === "function") {
    unsubscribe = watchAll(
      form,
      nameOrNamesOrCallback,
      (callbackOrOptions as UseWatchOptions) || {}
    )
  }
  // 单字段监听：useWatch('name', callback, options?)
  else if (typeof nameOrNamesOrCallback === "string") {
    unsubscribe = watchField(
      form,
      nameOrNamesOrCallback,
      callbackOrOptions as SingleFieldCallback,
      maybeOptions || {}
    )
  }
  // 多字段监听：useWatch(['name', 'age'], callback, options?)
  else {
    unsubscribe = watchFields(
      form,
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
 * useWatchField('name', (value, prevValue) => {
 *   console.log('name changed:', value)
 * })
 * ```
 */
export function useWatchField(
  name: NamePath,
  callback: SingleFieldCallback,
  options?: UseWatchOptions
): () => void {
  return useWatch(
    name,
    (value, prevValue, latestValues) => callback(value, prevValue, latestValues),
    options
  )
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
  names: NamePath[],
  callback: MultiFieldCallback,
  options?: UseWatchOptions
): () => void {
  return useWatch(
    names as string[],
    ((values: FormValues, prevValues: FormValues, changedFields: NamePath[]) =>
      callback(values, prevValues, changedFields)) as MultiFieldCallback,
    options
  )
}

/**
 * 监听所有字段变化的便捷方法
 *
 * @example
 * ```ts
 * useWatchAll((changedValues, latestValues) => {
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
