/**
 * useField - 字段控制 Hook
 *
 * 将 SchemxInstance 的方法作用域限定到指定字段，
 * 通过 @preact/signals-core 的 effect 桥接 core Signal 与 Vue 响应式系统，
 * 提供单字段的读写、校验等能力。
 *
 * @module hooks/useField
 *
 * @remarks
 * core 层的 FormStore 和 Validator 使用 Signal 管理状态，不具备 Vue 响应式能力。
 * useField 通过 signal effect 监听字段值和错误的 Signal 变化，
 * 将值同步到 Vue shallowRef 中，使 computed/watchEffect/render 能自动追踪变化。
 */

import { computed, onUnmounted, shallowRef } from "vue"
import type { DeepReadonly } from "vue"

import { getByPath, setByPath } from "@/utils"

import { useFormInstance } from "./useForm"

import type {
  FormValues,
  NamePath,
  SchemxRules,
  ValidateResult,
  Value,
} from "@schemx/core"

/**
 * 获取单个字段的控制能力
 *
 * 通过 @preact/signals-core effect 监听字段 Signal 变化，
 * 将值同步到 Vue shallowRef，实现框架无关 core 与 Vue 响应式系统的桥接。
 * 错误状态同样通过 signal effect 自动同步。
 *
 * @param name - 字段名（支持嵌套路径，如 'user.address.city'）
 * @returns 字段状态和操作方法
 *
 * @example
 * ```typescript
 * const field = useField('username')
 *
 * // 响应式值（在 computed/watchEffect/template 中自动追踪）
 * field.getValue()
 *
 * // 响应式错误
 * field.error.value   // string[] | undefined
 *
 * // 响应式脏状态
 * field.dirty.value   // boolean
 *
 * // 写入值
 * field.setValue('new value')
 *
 * // 校验
 * const result = await field.validate()
 * ```
 */
export const useField = <T extends FormValues = FormValues>(name: NamePath<T>) => {
  const form = useFormInstance<T>()

  /**
   * 字段当前值（响应式）
   *
   * 通过 signal effect 自动同步更新，在 computed/watchEffect/render 中自动追踪。
   */
  const fieldValue = shallowRef<Value>(form?.getFieldValue(name))

  /**
   * 字段错误信息（响应式）
   *
   * 通过 signal effect 自动同步更新。
   *
   * @example
   * ```typescript
   * field.error.value // => ['用户名不能为空'] 或 undefined
   * ```
   */
  const fieldError = shallowRef<string[] | undefined>(form?.getFieldError(name))

  /**
   * signal effect 桥接 core Signal → Vue shallowRef（字段值）
   *
   * effect 内部读取 form.getFieldValue(name)，自动追踪底层 Signal 依赖。
   * 当字段 Signal 值变化时 effect 重新执行，更新 Vue ref，驱动 Vue 响应式链路。
   */
  const disposeValueEffect = form.effect(() => {
    fieldValue.value = form?.getFieldValue(name)
  })

  /**
   * signal effect 桥接 core Signal → Vue shallowRef（错误信息）
   *
   * effect 内部读取 form.getFieldError(name)，自动追踪 Validator 的 errors SignalMap 依赖。
   * 当校验错误变化时 effect 重新执行，自动同步到 fieldError ref。
   */
  const disposeErrorEffect = form.effect(() => {
    fieldError.value = form?.getFieldError(name)
  })

  onUnmounted(() => {
    disposeValueEffect()
    disposeErrorEffect()
  })

  /**
   * 字段错误信息（响应式，只读）
   *
   * @example
   * ```typescript
   * field.error.value // => ['用户名不能为空'] 或 undefined
   * ```
   */
  const error = computed(() => fieldError.value)

  /**
   * 值是否与初始值不同（响应式）
   *
   * @example
   * ```typescript
   * field.dirty.value // => true（值已修改）
   * ```
   */
  const dirty = computed(() => {
    // 触发对 fieldValue 的依赖追踪
    void fieldValue.value

    return form?.isFieldTouched(name) ?? false
  })

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
   * 获取当前字段值（响应式）
   *
   * 返回 shallowRef 中的值，在 computed/watchEffect/render 中自动追踪变化。
   *
   * @returns 字段当前值
   *
   * @example
   * ```typescript
   * const value = field.getValue() // => 'hello'
   * ```
   */
  const getValue = () => fieldValue.value

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
   * 设置字段初始值
   *
   * @param value - 要设置的初始值
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
   * 获取表单全量值快照
   *
   * @returns 所有字段的原始值深拷贝
   * @see https://vuejs.org/api/reactivity-advanced.html#toraw
   *
   * @example
   * ```typescript
   * const all = field.getSnapshot() // => { username: 'a', email: 'b' }
   * ```
   */
  const getSnapshot = () => form?.getFieldsSnapshot()

  /**
   * 校验当前字段并同步错误状态
   *
   * @returns 校验结果，包含 ok 和 values/error
   *
   * @example
   * ```typescript
   * const result = await field.validate()
   * if (!result.ok) console.log(result.error)
   * ```
   */
  const validate = async (): Promise<ValidateResult<T>> => {
    if (form) {
      return await form.validateField([name])
    }

    return { ok: true, values: {} as DeepReadonly<T> } as ValidateResult<T>
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
  const getError = () => {
    return form?.getFieldError(name)
  }

  /**
   * 手动设置错误信息并同步响应式状态
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
   * @param rules - SchemxRules 校验规则（单个或数组）
   * @param defaultMessage - 可选，空值时的默认错误提示
   *
   * @example
   * ```typescript
   * field.registerRules(z.string().min(3, '最少3个字符'))
   * field.registerRules([minSchema, maxSchema], '请输入用户名')
   * ```
   */
  const registerRules = (
    rules: SchemxRules | SchemxRules[],
    defaultMessage?: string
  ): void => {
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

  return {
    // 响应式状态
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
  }
}

export default useField
