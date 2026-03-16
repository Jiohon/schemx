/**
 * SchemxFormInstance - 表单实例核心类
 *
 * 组合 Store、Validator、Subscriber，提供统一的表单操作接口。
 * 实现 SchemxFormInstance 接口，作为 useForm 的底层实现。
 *
 * @module hooks/useForm
 *
 * @example
 * ```typescript
 * import { useForm } from './useForm'
 *
 * // 在 Vue 组件中使用
 * const form = useForm({
 *   schemas: [...],
 *   initialValues: { name: '', age: 0 },
 *   onFinish: (values) => console.log(values),
 * })
 *
 * // 或直接创建实例（非组件场景）
 * const instance = createFormInstance({ initialValues: { name: '' } })
 * ```
 */
import { inject, onUnmounted, provide } from "vue"

import { createFormInstance } from "@schemx/core"

import type {
  CreateFormInstanceOptions,
  FormValues,
  SchemxFormInstance,
} from "@schemx/core"

/** SchemxFormInstance 在 Vue provide/inject 中的注入 key */
export const FORM_INSTANCE_KEY = Symbol("SchemxFormInstance")

/**
 * 表单组合式函数
 *
 * 创建 SchemxFormInstance 并通过 Vue provide 注入到子组件树中，
 * 组件卸载时自动销毁实例。
 *
 * @typeParam T - 表单值类型
 *
 * @param options - 表单配置选项
 * @returns 表单实例（SchemxInstance 接口）
 *
 * @example
 * ```typescript
 * // 在 setup 中使用
 * const form = useForm({
 *   initialValues: { name: '', email: '' },
 *   onFinish: async (values) => {
 *     await api.submit(values)
 *   },
 * })
 *
 * form.setFieldValue('name', 'John')
 * ```
 */
export function useForm<T extends FormValues>(
  options: CreateFormInstanceOptions<T> = {}
): SchemxFormInstance<T> {
  const instance = createFormInstance<T>(options)

  provide<SchemxFormInstance<T>>(FORM_INSTANCE_KEY, instance)

  onUnmounted(() => {
    instance.destroy()
  })

  return instance
}

/**
 * 获取表单实例
 *
 * 在子组件中获取 useForm 创建的 SchemxInstance，
 * 可用于读写字段值、校验、订阅等操作。
 *
 * @typeParam T - 表单值类型
 * @returns 表单实例
 *
 * @throws Error 如果不在 schemx 提供的上下文中调用
 *
 * @example
 * ```ts
 * const form = useFormInstance()
 * form.setFieldValue('name', 'hello')
 * ```
 */
export function useFormInstance<
  T extends FormValues = FormValues,
>(): SchemxFormInstance<T> {
  const instance = inject<SchemxFormInstance<T>>(FORM_INSTANCE_KEY)

  if (!instance) {
    throw new Error("useFormInstance must be used within a Form")
  }

  return instance
}

export default useForm
