/**
 * useField - 字段 Hook
 *
 * 获取单个字段的控制能力。
 *
 * @module hooks/useField
 */

import { computed, type ComputedRef } from "vue"

import type { FormValues, SchemaFormInstance } from "@/types"

import { useFormContext } from "./useFormContext"

/**
 * 字段状态接口
 */
export interface FieldState {
  /** 字段错误信息（响应式） */
  error: ComputedRef<string[] | undefined>
  /** 值是否与初始值不同（响应式） */
  dirty: ComputedRef<boolean>
  /** 值未被修改（dirty 的反义） */
  pristine: ComputedRef<boolean>
  /** 是否正在校验中（响应式） */
  isValidating: ComputedRef<boolean>
  /** 组件实例 */
  form: ComputedRef<SchemaFormInstance>
}

/**
 * 字段操作接口
 */
export interface FieldActions {
  /** 获取指定路径的初始值 */
  getInitialValue: (path: string) => any
  /** 设置值 */
  setValue: (value: any) => void
  /** 设置错误 */
  setError: (error: string[]) => void
  /** 获取错误信息 */
  getError: () => string[] | undefined
  /** 清除错误信息 */
  clearError: () => void
  /** 校验字段 */
  validate: () => Promise<boolean>
  /** 重置字段 */
  reset: () => void
  /** 获取当前 name 单值 */
  getValue: () => any
  /** 获取表单值 */
  getValues: () => FormValues
}

/**
 * useField 返回类型
 */
export interface UseFieldReturn extends FieldState, FieldActions {}

/**
 * useField 选项
 */
export interface UseFieldOptions {
  /** 值变化回调 */
  onChange?: (value: any) => void
}

/**
 * 获取单个字段的控制能力
 *
 * FormStore 的 state 已经是 Vue reactive 对象，
 * 所以 getFieldValue / getFieldsValue 在 computed 中使用时
 * 会自动建立响应式依赖，无需手动订阅。
 *
 * @param name - 字段名（支持嵌套路径，如 'user.address.city'）
 * @param options - 选项
 * @returns 字段状态和操作方法
 */
export const useField = (name: string, options: UseFieldOptions = {}): UseFieldReturn => {
  const context = useFormContext()

  const form = computed(() => context.form)

  // 计算属性：错误信息
  const error = computed(() => {
    return form.value?.getFieldError(name)
  })

  // 计算属性：值是否与初始值不同
  const dirty = computed(() => {
    return form.value?.isFieldTouched(name) ?? false
  })

  const pristine = computed(() => !dirty.value)

  const isValidating = computed(() => false)

  const getInitialValue = (path: string) => {
    return form.value?.getInitialValue(path)
  }

  // 直接读取响应式 state，在 render/computed 中自动追踪
  const getValue = () => {
    return form.value?.getFieldValue(name)
  }

  // 返回响应式 values 引用，computed 中使用时自动追踪所有字段变化
  const getValues = () => {
    return form.value?.getFieldsValue() as FormValues
  }

  const setValue = (newValue: any): void => {
    form.value?.setFieldValue(name, newValue)
    options.onChange?.(newValue)
  }

  const setError = (newError: string[]): void => {
    form.value?.setFieldError(name, newError)
  }

  const getError = () => {
    return form.value?.getFieldError(name)
  }

  const clearError = (): void => {
    form.value?.setFieldError(name, [])
  }

  const validate = async (): Promise<boolean> => {
    if (form.value) {
      await form.value.validateField([name])
    }

    return true
  }

  const reset = (): void => {
    form.value?.resetFields([name])
  }

  return {
    error,
    dirty,
    pristine,
    isValidating,
    form,
    getInitialValue,
    getValue,
    getValues,
    setValue,
    setError,
    getError,
    clearError,
    validate,
    reset,
  }
}

export default useField
