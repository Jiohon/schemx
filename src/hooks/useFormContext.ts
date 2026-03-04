/**
 * useFormContext - 获取表单上下文
 *
 * 在子组件中获取父组件通过 useForm 创建的表单实例。
 *
 * @module hooks/useFormContext
 */

import { inject, provide } from "vue"

import { FORM_INSTANCE_KEY } from "./useForm"

import type { FormValues, SchemaFormInstance, SchemaFormProps } from "../types"

/** FormContext 注入 key */
export const FORM_CONTEXT_KEY = Symbol("FormContext")

interface FormContextProps {
  columns?: SchemaFormProps["columns"]
  readonly?: SchemaFormProps["readonly"]
  disabled?: SchemaFormProps["disabled"]
  labelIcon?: SchemaFormProps["labelIcon"]
  labelAlign?: SchemaFormProps["labelAlign"]
  labelWidth?: SchemaFormProps["labelWidth"]
  contentAlign?: SchemaFormProps["contentAlign"]
  colon?: SchemaFormProps["colon"]
  validationTrigger?: SchemaFormProps["validationTrigger"]
  className?: SchemaFormProps["className"]
  style?: SchemaFormProps["style"]
}

/**
 *  * 创建表单上下文
 *
 * @param props 组件属性
 * @returns 表单上下文
 */
export const createFormContext = (props: FormContextProps) => {
  // 注入到子组件
  provide<FormContextProps>(FORM_CONTEXT_KEY, props)
}

/**
 * 获取表单上下文
 *
 * @throws 如果不在 useForm 提供的上下文中调用，会抛出错误
 */
export function useFormContext(): FormContextProps {
  const context = inject<FormContextProps>(FORM_CONTEXT_KEY)

  if (!context) {
    throw new Error("useFormContext must be used within a Form")
  }

  return context
}

/**
 * 获取表单instance上下文
 *
 * @throws 如果不在 useForm 提供的上下文中调用，会抛出错误
 */
export function useFormInstance<
  T extends FormValues = FormValues,
>(): SchemaFormInstance<T> {
  const instance = inject<SchemaFormInstance<T>>(FORM_INSTANCE_KEY)

  if (!instance) {
    throw new Error("useFormInstance must be used within a Form")
  }

  return instance
}
