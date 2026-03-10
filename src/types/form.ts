/**
 * 表单组件 Props 类型
 *
 * 定义 SchemaForm 组件及 FormItem 组件的 Props 接口。
 *
 * @module types/form
 */

import type { CSSProperties, DeepReadonly } from "vue"

import type { DynamicProp, FormValues, NamePath, ValidationTrigger } from "./base"
import type { SchemaFormInstance } from "./instance"
import type { SchemaBaseColumn, SchemaColumn } from "./schema"
import type { Registry } from "../core/registry"
import type { ValidateError } from "../core/validator"

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
  labelAlign?: "left" | "center" | "right"
  /** 表单 label 位置 */
  labelPosition?: "left" | "top" | "right"
  /** 表单 label 宽度 */
  labelWidth?: string
  /** 表单内容排列方向 */
  contentAlign?: "left" | "center" | "right"
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
  /** 表单提交校验通过后的回调 */
  onFinish?: (values: DeepReadonly<T>) => void | Promise<void>
  /** 表单提交校验失败后的回调 */
  onFinishFailed?: (error: ValidateError<T>) => void
  /** 字段值更新时触发的回调 */
  onValuesChange?: (
    changedValues: DeepReadonly<Partial<T>>,
    latestSnapshot: DeepReadonly<T> | T
  ) => void
  /** 字段更新时触发的回调 */
  onFieldsChange?: (changedFields: NamePath<T>[], allFields: NamePath<T>[]) => void
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
