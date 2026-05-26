/**
 * createField - 框架无关的单字段控制器
 *
 * 将 SchemxInstance 的方法作用域限定到指定字段，
 * 提供单字段的读写、校验、状态订阅等能力。
 * 框架适配层（Vue / React）可通过 `effect` 桥接各自的响应式系统。
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
 * const dispose = field.effect(() => {
 *   console.log('value:', field.getValue())
 *   console.log('errors:', field.getError())
 * })
 *
 * dispose() // 取消订阅
 * ```
 */

import { setByPath } from "./utils"

import type { NamePath, PathValue, SchemxInstance, SchemxRules, Values } from "./types"
import type { ValidateResult } from "./validator"

/**
 * 单字段控制器接口
 *
 * 封装 SchemxInstance 中与单个字段相关的所有操作，
 * 以及基于 reactive effect 的状态订阅能力。
 *
 * @typeParam TValues - 表单值类型
 * @typeParam TName - 当前字段路径类型
 * @typeParam TValue - 当前字段值类型
 */
export interface SchemxFieldInstance<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TValue = PathValue<TValues, TName>,
> {
  /**
   * 获取当前字段值。
   *
   * @returns 当前字段值；字段不存在时返回 undefined。
   */
  getValue: () => TValue | undefined

  /**
   * 设置当前字段值。
   *
   * @param value - 新字段值。
   */
  setValue: (value: TValue) => void

  /**
   * 获取字段初始值。
   *
   * @returns 当前字段的初始值；未设置时返回 undefined。
   */
  getInitialValue: () => TValue | undefined

  /**
   * 设置字段初始值。
   *
   * @param value - 新初始值。
   */
  setInitialValue: (value: TValue) => void

  /**
   * 获取表单全量响应式值。
   *
   * @returns 当前表单值。
   */
  getValues: () => Readonly<TValues>

  /**
   * 获取表单全量快照。
   *
   * @returns 当前表单值快照。
   */
  getSnapshot: () => TValues

  /**
   * 校验当前字段。
   *
   * @returns 当前字段校验结果。
   */
  validate: () => Promise<ValidateResult<TValues>>

  /**
   * 获取当前字段错误信息。
   *
   * @returns 错误信息数组；没有错误时返回 undefined。
   */
  getError: () => string[] | undefined

  /**
   * 设置当前字段错误信息。
   *
   * @param errors - 错误信息数组。
   */
  setError: (errors: string[]) => void

  /**
   * 清除当前字段错误信息。
   */
  clearError: () => void

  /**
   * 注册当前字段校验规则。
   *
   * @param rules - 校验规则或规则数组。
   * @param defaultMessage - 可选的默认错误信息。
   */
  registerRules: (rules: SchemxRules | SchemxRules[], defaultMessage?: string) => void

  /**
   * 注销当前字段校验规则。
   */
  unregisterRules: () => void

  /**
   * 检查当前字段是否已被触摸。
   *
   * @returns 是否已被触摸。
   */
  isTouched: () => boolean

  /**
   * 重置当前字段到初始值。
   */
  reset: () => void

  /**
   * 设置当前字段操作中状态。
   *
   * @param pending - 是否处于操作中。
   * @param message - 可选的操作中提示信息。
   */
  setPending: (pending: boolean, message?: string) => void

  /**
   * 检查当前字段是否处于操作中。
   *
   * @returns 是否处于操作中。
   */
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
 * const dispose = field.effect(() => {
 *   console.log(field.getValue())
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
    return form.validateField(name)
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
