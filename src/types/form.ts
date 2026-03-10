/**
 * 表单组件 Props 类型
 *
 * 定义 SchemaForm 组件及 FormItem 组件的 Props 接口。
 *
 * @module types/form
 */

import type { CSSProperties, DeepReadonly } from "vue"

import type { CustomRules, DynamicProp, FormValues, ValidationTrigger } from "./base"
import type { SchemaFormInstance } from "./instance"
import type { SchemaBaseColumn, SchemaColumn, SchemaDependencyColumn } from "./schema"
import type { ValidateError } from "../core/validator"
import type { Registry } from "../core/registry"

/**
 * 通用组件 Props 基础接口
 */
export interface ComponentsProps {
  /** 自定义类名 */
  className?: string
  /** 自定义样式 */
  style?: CSSProperties
  [key: string]: unknown
}

/**
 * 表单项组件 Props 接口
 *
 * 继承自 ComponentsProps，添加 placeholder 动态属性支持。
 */
export interface ColumnComponentsProps extends ComponentsProps {
  /** 占位符（支持函数形式） */
  placeholder?: DynamicProp<string>
}

/**
 * FormItem 组件 Props
 */
export type FormItemProps = Omit<SchemaBaseColumn, "componentProps">

/**
 * SchemaForm 组件 Props
 *
 * @typeParam T - 表单值类型
 */
export interface SchemaFormProps<T extends FormValues = FormValues> {
  /** 表单数据（v-model） */
  modelValue?: T
  /** 初始值 */
  initialValues?: T
  /** 表单字段配置 */
  columns: SchemaColumn[]
  /** 表单实例 */
  form?: SchemaFormInstance
  /** 渲染器注册实例 */
  rendererRegistry?: Registry
  /** 验证触发时机 */
  validationTrigger?: ValidationTrigger | ValidationTrigger[]
  /** 标签图标 */
  labelIcon?: string
  /** 表单 label 排列方向 */
  labelAlign?: "left" | "right" | "top"
  /** 表单 label 宽度 */
  labelWidth?: string
  /** 表单内容排列方向 */
  contentAlign?: "left" | "right" | "top"
  /** 是否在 label 后面添加冒号 */
  colon?: boolean
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 自定义类名 */
  className?: string
  /** 自定义样式 */
  style?: CSSProperties
  /** 提交成功回调 */
  onFinish?: (values: DeepReadonly<T>) => void
  /** 提交失败回调 */
  onFinishFailed?: (errorInfo: ValidateError<T>) => void
  /** 值变化回调 */
  onValuesChange?: (changedValues: Partial<T>, latestValues: T) => void
  /** 字段变化回调 */
  onFieldsChange?: (changedFields: string[], allFields: string[]) => void
  /** 是否显示底部按钮 */
  footer?: boolean | object | (() => boolean)
  /** 提交按钮文本 */
  submitButtonText?: string
  /** 提交按钮属性 */
  submitButtonProps?: ComponentsProps
  /** 全局 HTTP 请求器，作为该表单实例内所有 useDictOptions 的默认请求器 */
  request?: (url: string) => Promise<any>
}

/**
 * 全局状态配置
 *
 * 从 SchemaFormProps 中提取的全局只读/禁用/触发时机配置。
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GlobalContext extends Pick<
  SchemaFormProps,
  "readonly" | "disabled" | "validationTrigger"
> {}
