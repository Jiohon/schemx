/**
 * createField - 框架无关的单字段控制器
 *
 * 将 SchemxInstance 的方法作用域限定到指定字段，
 * 提供单字段的读写、校验、状态订阅等能力。
 * 框架适配层（Vue / React）通过 subscribe 回调桥接各自的响应式系统。
 *
 * @module core/createField
 *
 * @example
 * ```ts
 * import { createField, createForm } from '@schemx/core'
 *
 * const form = createForm({ initialValues: { name: '', avatar: '' } })
 * const field = createField(form, 'name')
 *
 * field.setValue('John')
 * field.getValue() // => 'John'
 *
 * const dispose = field.subscribe({
 *   onValueChange: (v) => console.log('value:', v),
 *   onErrorChange: (e) => console.log('errors:', e),
 * })
 *
 * dispose() // 取消订阅
 * ```
 */

import { setByPath } from "./utils"

import type {
  NamePath,
  PathValue,
  SchemxInstance,
  SchemxRules,
  Value,
  Values,
} from "./types"
import type { ValidateResult } from "./validator"

/**
 * subscribe 回调集合
 *
 * 框架适配层通过这些回调将 core reactive value 变化同步到各自的响应式容器中。
 */
export interface FieldSubscribeCallbacks {
  /** 字段值变化回调 */
  onValueChange?: (value: Value) => void
  /** 字段错误信息变化回调 */
  onErrorChange?: (errors: string[] | undefined) => void
  /** 字段操作中状态变化回调 */
  onPendingChange?: (pending: boolean) => void
}

/**
 * 单字段控制器接口
 *
 * 封装 SchemxInstance 中与单个字段相关的所有操作，
 * 以及基于 reactive effect 的状态订阅能力。
 *
 * @typeParam TValues - 表单值类型
 */
export interface SchemxFieldInstance<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TValue = PathValue<TValues, TName>,
> {
  /** 获取当前字段值（读取 reactive value，在 effect 中自动追踪） */
  getValue: () => TValue | undefined
  /** 设置字段值 */
  setValue: (value: TValue) => void
  /** 获取字段初始值 */
  getInitialValue: () => TValue | undefined
  /** 设置字段初始值 */
  setInitialValue: (value: TValue) => void
  /** 获取表单全量值 */
  getValues: () => Readonly<TValues>
  /** 获取表单全量快照 */
  getSnapshot: () => TValues
  /** 校验当前字段 */
  validate: () => Promise<ValidateResult<TValues>>
  /** 获取错误信息 */
  getError: () => string[] | undefined
  /** 设置错误信息 */
  setError: (errors: string[]) => void
  /** 清除错误信息 */
  clearError: () => void
  /** 注册校验规则 */
  registerRules: (rules: SchemxRules | SchemxRules[], defaultMessage?: string) => void
  /** 注销校验规则 */
  unregisterRules: () => void
  /** 是否被修改 */
  isTouched: () => boolean
  /** 重置到初始值 */
  reset: () => void
  /** 设置操作中状态 */
  setPending: (pending: boolean, message?: string) => void
  /** 是否操作中 */
  isPending: () => boolean

  /**
   * 创建 reactive effect
   *
   * 直接透传 form.effect，在回调中访问 getValue / getError / isPending 时
   * 自动追踪对应 reactive 依赖，依赖变化时 effect 自动重新执行。
   *
   * @param fn - effect 回调函数
   * @returns dispose 函数，取消 effect
   *
   * @example
   * ```ts
   * const dispose = field.effect(() => {
   *   console.log('value:', field.getValue())
   * })
   * dispose()
   * ```
   */
  effect: (fn: () => void) => () => void
}

/**
 * 创建单字段控制器
 *
 * 将 SchemxInstance 的方法作用域限定到指定字段，
 * 返回包含读写、校验、状态订阅等能力的控制器对象。
 *
 * @typeParam TValues - 表单值类型
 *
 * @param form - 表单实例
 * @param name - 字段路径
 * @returns 单字段控制器
 *
 * @example
 * ```ts
 * const field = createField(form, 'username')
 *
 * field.setValue('John')
 * field.getValue() // => 'John'
 *
 * const dispose = field.subscribe({
 *   onValueChange: (v) => console.log(v),
 * })
 * ```
 */
export function createField<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TValue = PathValue<TValues, TName>,
>(
  form: SchemxInstance<TValues, TName, TValue>,
  name: TName
): SchemxFieldInstance<TValues, TName, TValue> {
  const getValue = (): TValue | undefined => form.getFieldValue(name)

  const setValue = (value: TValue): void => {
    form.setFieldValue(name, value)
  }

  const getInitialValue = (): TValue | undefined => {
    return form.getInitialValue(name)
  }

  const setInitialValue = (value: TValue): void => {
    const result = {}
    setByPath(result, name, value)
    form.setInitialValues(result)
  }

  const getValues = (): Readonly<TValues> => form.getFieldsValue()

  const getSnapshot = (): TValues => form.getFieldsSnapshot()

  const validate = (): Promise<ValidateResult<TValues>> => {
    return form.validateField([name])
  }

  const getError = (): string[] | undefined => form.getFieldError(name)

  const setError = (errors: string[]): void => {
    form.setFieldError(name, errors)
  }

  const clearError = (): void => {
    form.setFieldError(name, [])
  }

  const registerRules = (
    rules: SchemxRules | SchemxRules[],
    defaultMessage?: string
  ): void => {
    form.registerRules(name, rules, defaultMessage)
  }

  const unregisterRules = (): void => {
    form.unregisterRules(name)
  }

  const isTouched = (): boolean => form.isFieldTouched(name) ?? false

  const reset = (): void => {
    form.resetFields([name])
  }

  const setPending = (pending: boolean, _message?: string): void => {
    form.setFieldPending(name, pending)
  }

  const isPending = (): boolean => form.isFieldPending(name) ?? false

  const effect = (fn: () => void): (() => void) => {
    return form.effect(fn)
  }

  return {
    getValue,
    setValue,
    getInitialValue,
    setInitialValue,
    getValues,
    getSnapshot,
    validate,
    getError,
    setError,
    clearError,
    registerRules,
    unregisterRules,
    isTouched,
    reset,
    setPending,
    isPending,
    effect,
  }
}
