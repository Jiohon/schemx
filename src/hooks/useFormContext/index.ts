/**
 * useFormContext - 表单上下文 Hook
 *
 * 提供表单上下文的创建与消费能力。
 * SchemaForm 通过 createFormContext 注入全局配置，
 * 子组件通过 useFormContext 获取。
 *
 * @module hooks/useFormContext
 */

import { inject, provide } from "vue"

import type { SchemaFormProps } from "../../types"

/** FormContext 注入 key */
export const FORM_CONTEXT_KEY = Symbol("FormContext")

/**
 * 表单上下文属性
 *
 * 由 SchemaForm 组件注入，包含表单级别的全局配置。
 */
interface FormContextProps {
  /** 表单字段配置 */
  columns?: SchemaFormProps["columns"]
  /** 是否只读 */
  readonly?: SchemaFormProps["readonly"]
  /** 是否禁用 */
  disabled?: SchemaFormProps["disabled"]
  /** 标签图标 */
  labelIcon?: SchemaFormProps["labelIcon"]
  /** 表单 label 排列方向 */
  labelAlign?: SchemaFormProps["labelAlign"]
  /** 表单 label 宽度 */
  labelWidth?: SchemaFormProps["labelWidth"]
  /** 表单内容排列方向 */
  contentAlign?: SchemaFormProps["contentAlign"]
  /** 是否在 label 后面添加冒号 */
  colon?: SchemaFormProps["colon"]
  /** 默认的验证触发时机 */
  validationTrigger?: SchemaFormProps["validationTrigger"]
  /** 自定义类名 */
  className?: SchemaFormProps["className"]
  /** 自定义样式 */
  style?: SchemaFormProps["style"]
  /** HTTP 请求器（由 SchemaForm props.request 注入） */
  request?: SchemaFormProps["request"]
}

/**
 * 创建并注入表单上下文
 *
 * 在 SchemaForm 的 setup 中调用，将表单级别配置注入到子组件树中。
 *
 * @param props - 表单上下文属性
 */
export const createFormContext = (props: FormContextProps) => {
  provide<FormContextProps>(FORM_CONTEXT_KEY, props)
}

/**
 * 获取表单上下文配置
 *
 * 在子组件中获取 SchemaForm 注入的全局配置（readonly、disabled、labelAlign 等）。
 *
 * @returns 表单上下文属性
 *
 * @throws Error 如果不在 SchemaForm 提供的上下文中调用
 *
 * @example
 * ```ts
 * const context = useFormContext()
 * console.log(context.readonly, context.disabled)
 * ```
 */
export function useFormContext(): FormContextProps {
  const context = inject<FormContextProps>(FORM_CONTEXT_KEY)

  if (!context) {
    throw new Error("useFormContext must be used within a Form")
  }

  return context
}
