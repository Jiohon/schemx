/**
 * useFormContext - 获取表单上下文
 *
 * 在子组件中获取父组件通过 useForm 创建的表单实例。
 *
 * @module hooks/useFormContext
 */

import { inject, provide } from "vue"

import type { SchemaFormInstance, SchemaFormProps } from "../types"

/** FormContext 注入 key */
export const FORM_CONTEXT_KEY = Symbol("FormContext")

interface FormContextProps {
  validationTrigger?: SchemaFormProps["validationTrigger"]
  columns?: SchemaFormProps["columns"]
  readonly?: SchemaFormProps["readonly"]
  disabled?: SchemaFormProps["disabled"]
  labelAlign?: SchemaFormProps["labelAlign"]
  labelWidth?: SchemaFormProps["labelWidth"]
  colon?: SchemaFormProps["colon"]
  className?: SchemaFormProps["className"]
  style?: SchemaFormProps["style"]
  form: SchemaFormInstance
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
  const contextRef = inject<FormContextProps>(FORM_CONTEXT_KEY)

  if (!contextRef) {
    throw new Error("useFormContext must be used within a Form")
  }

  return contextRef
}
