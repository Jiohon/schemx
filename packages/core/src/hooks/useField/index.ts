/**
 * useField - 字段控制 Hook
 *
 * 将 SchemaFormInstance 的方法作用域限定到指定字段，
 * 提供单字段的读写、校验、订阅等能力。
 *
 * @module hooks/useField
 */

import { computed } from "vue"
import type { DeepReadonly } from "vue"

import type { FieldSubscribeCallback } from "@/core/subscriber"
import type { ValidateResult } from "@/core/validator"
import type { FormValues, NamePath, Rules, Value } from "@/types"
import { getByPath, setByPath } from "@/utils"

import { useFormInstance } from "../useForm"

/**
 * 获取单个字段的控制能力
 *
 * 将 SchemaFormInstance 的方法作用域限定到指定字段，
 * FormStore 的 state 是 Vue reactive 对象，
 * getFieldValue / getFieldsValue 在 computed 中使用时自动建立响应式依赖。
 *
 * @param name - 字段名（支持嵌套路径，如 'user.address.city'）
 * @returns 字段状态和操作方法
 *
 * @example
 * ```typescript
 * const field = useField('username')
 *
 * // 读写值
 * field.getValue()
 * field.setValue('new value')
 *
 * // 校验
 * const result = await field.validate()
 *
 * // 响应式状态
 * field.error.value   // string[] | undefined
 * field.dirty.value   // boolean
 *
 * // 规则管理
 * field.registerRules(z.string().min(3))
 * field.unregisterRules()
 *
 * // 订阅
 * const unsub = field.subscribe((payload, prevSnapshot, latestSnapshot) => { ... })
 * ```
 */
export const useField = (name: NamePath) => {
  /**
   * 表单实例引用
   *
   * @example
   * ```typescript
   * field.form.validate()
   * ```
   */
  const form = useFormInstance()

  /**
   * 字段错误信息（响应式）
   *
   * @example
   * ```typescript
   * field.error.value // => ['用户名不能为空'] 或 undefined
   * ```
   */
  const error = computed(() => form?.getFieldError(name))

  /**
   * 值是否与初始值不同（响应式）
   *
   * @example
   * ```typescript
   * field.dirty.value // => true（值已修改）
   * ```
   */
  const dirty = computed(() => form?.isFieldTouched(name) ?? false)

  /**
   * 值未被修改（dirty 的反义，响应式）
   *
   * @example
   * ```typescript
   * field.pristine.value // => true（值未修改）
   * ```
   */
  const pristine = computed(() => !dirty.value)

  /**
   * 获取当前字段值
   *
   * @returns 字段当前值（响应式，在 computed/render 中自动追踪）
   *
   * @example
   * ```typescript
   * const value = field.getValue() // => 'hello'
   * ```
   */
  const getValue = () => form?.getFieldValue(name)

  /**
   * 设置当前字段值
   *
   * @param value - 要设置的值
   *
   * @example
   * ```typescript
   * field.setValue('new value')
   * field.setValue({ nested: true })
   * ```
   */
  const setValue = (value: Value): void => {
    form?.setFieldValue(name, value)
  }

  /**
   * 获取字段初始值
   *
   * @returns 字段初始值
   *
   * @example
   * ```typescript
   * const initial = field.getInitialValue() // => ''
   * ```
   */
  const getInitialValue = () => {
    return getByPath(form?.getInitialValues([name]), name)
  }

  /**
   * 获取字段初始值
   *
   * @returns 字段初始值
   *
   * @example
   * ```typescript
   * field.setInitialValue('initial value')
   * ```
   */
  const setInitialValue = (value: Value) => {
    const result = {}

    setByPath(result, name, value)

    form?.setInitialValues(result)
  }

  /**
   * 获取表单全量值
   *
   * @returns 所有字段的只读值
   *
   * @example
   * ```typescript
   * const all = field.getValues() // => { username: 'a', email: 'b' }
   * ```
   */
  const getValues = () => form?.getFieldsValue()

  /**
   * 获取表单全量值
   *
   * @returns 所有字段的原始值，调用toRaw返回
   * @see https://vuejs.org/api/reactivity-advanced.html#toraw
   *
   * @example
   * ```typescript
   * const all = field.getSnapshot() // => { username: 'a', email: 'b' }
   * ```
   */
  const getSnapshot = () => form?.getFieldsSnapshot()

  /**
   * 校验当前字段
   *
   * @returns 校验结果，包含 ok 和 values/error
   *
   * @example
   * ```typescript
   * const result = await field.validate()
   * if (!result.ok) console.log(result.error)
   * ```
   */
  const validate = async (): Promise<ValidateResult<FormValues>> => {
    if (form) {
      return form.validateField([name])
    }

    return { ok: true, values: {} as DeepReadonly<FormValues> }
  }

  /**
   * 获取错误信息
   *
   * @returns 错误信息数组，无错误时返回 undefined
   *
   * @example
   * ```typescript
   * field.getError() // => ['最少3个字符'] 或 undefined
   * ```
   */
  const getError = () => form?.getFieldError(name)

  /**
   * 手动设置错误信息
   *
   * @param errors - 错误信息数组
   *
   * @example
   * ```typescript
   * field.setError(['用户名已存在'])
   * ```
   */
  const setError = (errors: string[]): void => {
    form?.setFieldError(name, errors)
  }

  /**
   * 清除错误信息
   *
   * @example
   * ```typescript
   * field.clearError()
   * ```
   */
  const clearError = (): void => {
    form?.setFieldError(name, [])
  }

  /**
   * 注册校验规则
   *
   * 支持传入单个 schema 或 schema 数组。
   *
   * @param rules - Rules 校验规则（单个或数组）
   * @param defaultMessage - 可选，空值时的默认错误提示
   *
   * @example
   * ```typescript
   * field.registerRules(z.string().min(3, '最少3个字符'))
   * field.registerRules([minSchema, maxSchema], '请输入用户名')
   * ```
   */
  const registerRules = (rules: Rules | Rules[], defaultMessage?: string): void => {
    form?.registerRules(name, rules, defaultMessage)
  }

  /**
   * 注销校验规则
   *
   * @example
   * ```typescript
   * field.unregisterRules()
   * ```
   */
  const unregisterRules = (): void => {
    form?.unregisterRules(name)
  }

  /**
   * 当前字段是否被修改
   *
   * @returns 是否与初始值不同
   *
   * @example
   * ```typescript
   * field.isTouched() // => true
   * ```
   */
  const isTouched = () => form?.isFieldTouched(name) ?? false

  /**
   * 重置当前字段到初始值
   *
   * @example
   * ```typescript
   * field.reset()
   * ```
   */
  const reset = (): void => {
    form?.resetFields([name])
  }

  /**
   * 订阅当前字段变化
   *
   * @param callback - 变化时的回调函数
   * @returns 取消订阅的函数
   *
   * @example
   * ```typescript
   * const unsub = field.subscribe((payload, prevSnapshot, latestSnapshot) => {
   *   console.log(`${payload.path} changed to`, payload.value)
   * })
   * unsub() // 取消订阅
   * ```
   */
  const subscribe = (callback: FieldSubscribeCallback<FormValues>) => {
    return form?.subscribe(name, callback) ?? (() => {})
  }

  return {
    // 状态
    error,
    dirty,
    pristine,
    form,
    // 值操作
    getValue,
    setValue,
    getInitialValue,
    setInitialValue,
    getValues,
    getSnapshot,
    // 校验
    validate,
    getError,
    setError,
    clearError,
    registerRules,
    unregisterRules,
    // Touched
    isTouched,
    // 重置
    reset,
    // 订阅
    subscribe,
  }
}

export default useField
