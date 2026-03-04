import type { Component, CSSProperties, DeepReadonly } from "vue"

import Registry from "@/renderer/rendererRegistry"

import type { DeepNamePath } from "./namePathType"
import type { FieldSubscribeCallback, GlobalSubscribeCallback } from "../core/subscriber"
import type { ValidateError, ValidateResult } from "../core/validator"
import type { ZodType } from "zod"

export type ResolveDynamic<T> = {
  [K in keyof T]: T[K] extends DynamicProp<infer U> ? U : T[K]
}

export type Value = any

export type FormValues = Record<string, Value>

export type NamePath<T = any> = DeepNamePath<T>

// ============================================================================
// 渲染器类型体系
// ============================================================================

/**
 * 自定义渲染器类型扩展接口
 *
 * 用户可以通过声明合并来扩展自定义渲染器类型：
 *
 * @example
 * ```typescript
 * // 在你的项目中创建 schema-form.d.ts
 * declare module '@Jonhn/schema-form' {
 *   interface CustomRendererTypes {
 *     'my-custom-input': true
 *     'rich-editor': true
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CustomRendererTypes {}

/**
 * 渲染器类型
 *
 * 组合内置类型 + 自定义扩展类型 + 依赖类型
 * - DefaultRendererType: 内置渲染器
 * - keyof CustomRendererTypes: 用户扩展的自定义渲染器
 * - "dependency": 依赖字段特殊类型
 */
export type RendererType = keyof CustomRendererTypes

/**
 * 自定义渲染器 Props 映射扩展接口
 *
 * 用户可以通过声明合并来扩展自定义渲染器的 Props 映射：
 *
 * @example
 * ```typescript
 * declare module '@' {
 *   interface CustomRendererPropsMap {
 *     'rich-editor': RichEditorProps
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CustomRendererPropsMap {}

/**
 * 完整的渲染器 Props 映射
 *
 * 合并内置映射和自定义扩展映射
 */
export type RendererPropsMap = CustomRendererPropsMap

/** 验证规则触发时机 */
export type ValidationTrigger =
  | "onBlur"
  | "onChange"
  | "onSubmit"
  | "blur"
  | "change"
  | "submit"

/**
 * 动态属性类型
 *
 * 支持静态值或函数形式，函数接收当前表单值并返回属性值
 */
export type DynamicProp<T> = ((values: FormValues) => T | Promise<T>) | T

// ============================================================================
// 表单核心类型
// ============================================================================

export interface ComponentsProps {
  className?: string
  style?: CSSProperties
  [key: string]: unknown
}

/**
 * 表单实例接口
 *
 * 定义表单的所有操作方法，是 useForm 返回值的基础接口。
 * UseFormReturn 继承此接口并添加响应式状态。
 */
export interface SchemaFormInstance<T extends FormValues = FormValues> {
  /**
   * 设置单个字段值
   *
   * @param name - 字段路径
   * @param value - 字段值
   *
   * @example
   * ```typescript
   * form.setFieldValue('name', 'John')
   * form.setFieldValue('user.address.city', 'Beijing')
   * ```
   */
  setFieldValue: (name: NamePath<T>, value: Value) => void

  /**
   * 批量设置字段值
   *
   * @param values - 要设置的字段值对象
   *
   * @example
   * ```typescript
   * form.setFieldsValue({ name: 'John', age: 25 })
   * ```
   */
  setFieldsValue: (values: DeepReadonly<Partial<T>>) => void

  /**
   * 获取单个字段值
   *
   * @param name - 字段路径
   * @returns 字段当前值
   *
   * @example
   * ```typescript
   * const name = form.getFieldValue('name')
   * const city = form.getFieldValue('user.address.city')
   * ```
   */
  getFieldValue: (name: NamePath<T>) => DeepReadonly<Value>

  /**
   * 获取多个字段值
   *
   * 不传参数返回所有值（DeepReadonly 只读引用），传入路径数组返回指定字段的值。
   *
   * @param names - 可选，要获取的字段路径数组
   * @returns 全量只读值或指定字段的值
   *
   * @example
   * ```typescript
   * const latestValues = form.getFieldsValue()       // DeepReadonly<T>
   * const partial = form.getFieldsValue(['name', 'email'])
   * ```
   */
  getFieldsValue: (names?: NamePath<T>[]) => DeepReadonly<Partial<T>>

  /**
   * 获取字段初始值
   *
   * @param name - 字段路径
   * @returns 字段初始值
   *
   * @example
   * ```typescript
   * const initialName = form.getInitialValue('name')
   * ```
   */
  getInitialValue: (name: NamePath<T>) => Value

  /**
   * 注册字段校验规则
   *
   * @param name - 字段路径
   * @param rules - Zod schema 规则
   *
   * @example
   * ```typescript
   * import { z } from 'zod'
   * form.registerRules('email', z.string().email('邮箱格式错误'))
   * ```
   */
  registerRules: (name: NamePath<T>, rules: ZodType) => void

  /**
   * 注销字段校验规则
   *
   * @param name - 字段路径
   *
   * @example
   * ```typescript
   * form.unregisterRules('email')
   * ```
   */
  unregisterRules: (name: NamePath<T>) => void

  /**
   * 从 columns 配置提取并注册所有规则
   *
   * @param columns - 表单列配置数组
   *
   * @example
   * ```typescript
   * form.registerRulesFromColumns(columns)
   * ```
   */
  registerRulesFromColumns: (columns: SchemaColumn<T>[]) => void

  /**
   * 校验指定字段
   *
   * @param names - 字段路径或路径数组
   * @returns 校验结果，成功返回 values，失败返回 errors
   *
   * @example
   * ```typescript
   * const result = await form.validateField('email')
   * const result = await form.validateField(['name', 'email'])
   * if (!result.ok) {
   *   console.log(result.error.errors)
   * }
   * ```
   */
  validateField: (names: NamePath | NamePath<T>[]) => Promise<ValidateResult<T>>

  /**
   * 校验所有已注册字段
   *
   * @returns 校验结果，成功返回 values，失败返回 errors
   *
   * @example
   * ```typescript
   * const result = await form.validate()
   * if (result.ok) {
   *   submitToServer(result.values)
   * }
   * ```
   */
  validate: () => Promise<ValidateResult<T>>

  /**
   * 获取单个字段的错误信息
   *
   * @param name - 字段路径
   * @returns 错误信息数组，无错误时返回 undefined
   *
   * @example
   * ```typescript
   * const errors = form.getFieldError('email')
   * // => ['邮箱格式错误'] 或 undefined
   * ```
   */
  getFieldError: (name: NamePath<T>) => string[] | undefined

  /**
   * 手动设置字段的错误信息
   *
   * @param name - 字段路径
   * @param errors - 错误信息数组
   *
   * @example
   * ```typescript
   * form.setFieldError('username', ['用户名已存在'])
   * ```
   */
  setFieldError: (name: NamePath<T>, errors: string[]) => void

  /**
   * 提交表单
   *
   * 先校验所有字段，通过后调用 onFinish，失败调用 onFinishFailed。
   * 内置防重复提交锁，提交进行中重复调用返回同一个 Promise。
   *
   * @example
   * ```typescript
   * await form.submit()
   * ```
   */
  submit: () => Promise<void>

  /**
   * 重置整个表单到初始值
   *
   * @example
   * ```typescript
   * form.reset()
   * ```
   */
  reset: () => void

  /**
   * 重置指定字段到初始值
   *
   * @param names - 要重置的字段路径数组
   *
   * @example
   * ```typescript
   * form.resetFields(['name', 'email'])
   * ```
   */
  resetFields: (names: NamePath<T>[]) => void

  /**
   * 检查单个字段是否被修改
   *
   * @param name - 字段路径
   * @returns 是否与初始值不同
   *
   * @example
   * ```typescript
   * form.isFieldTouched('name') // => true
   * ```
   */
  isFieldTouched: (name: string) => boolean

  /**
   * 检查多个字段是否被修改
   *
   * 传入路径数组时检查所有指定字段是否都被修改，不传则检查是否有任一字段被修改。
   *
   * @param names - 可选，要检查的字段路径
   * @returns 是否被修改
   *
   * @example
   * ```typescript
   * form.isFieldsTouched(['name', 'email']) // 所有字段都被修改才返回 true
   * form.isFieldsTouched()                  // 任一字段被修改即返回 true
   * ```
   */
  isFieldsTouched: (names?: NamePath<T>) => boolean

  /**
   * 获取所有被修改的字段路径
   *
   * @returns 被修改的字段路径数组
   *
   * @example
   * ```typescript
   * const touched = form.getTouchedFields()
   * // => ['name', 'user.address.city']
   * ```
   */
  getTouchedFields: () => string[]

  /**
   * 订阅单个字段变化
   *
   * 当订阅的字段或其父/子路径发生变化时，都会收到通知。
   *
   * @param path - 要订阅的字段路径
   * @param callback - 变化时的回调函数
   * @returns 取消订阅的函数
   *
   * @example
   * ```typescript
   * const unsubscribe = form.subscribe('name', (path, value, latestValues) => {
   *   console.log(`${path} changed to ${value}`)
   * })
   * unsubscribe()
   * ```
   */
  subscribe: (path: NamePath<T>, callback: FieldSubscribeCallback<T>) => () => void

  /**
   * 订阅多个字段变化
   *
   * 当任一指定字段变化时触发回调。
   *
   * @param paths - 要订阅的字段路径数组
   * @param callback - 变化时的回调函数
   * @returns 取消所有订阅的函数
   *
   * @example
   * ```typescript
   * const unsubscribe = form.subscribeFields(['name', 'email'], (path, value) => {
   *   console.log(`${path} changed`)
   * })
   * unsubscribe()
   * ```
   */
  subscribeFields: (
    paths: NamePath<T>[],
    callback: FieldSubscribeCallback<T>
  ) => () => void

  /**
   * 订阅所有字段变化
   *
   * 当任何字段值变化时都会收到通知。
   *
   * @param callback - 变化时的回调函数
   * @returns 取消订阅的函数
   *
   * @example
   * ```typescript
   * const unsubscribe = form.subscribeAll((latestValues, changedValues, changedFields) => {
   *   console.log('Changed:', changedFields)
   * })
   * unsubscribe()
   * ```
   */
  subscribeAll: (callback: GlobalSubscribeCallback<T>) => () => void

  /**
   * 销毁表单实例，清除所有订阅
   *
   * @example
   * ```typescript
   * form.destroy()
   * ```
   */
  destroy: () => void
}

export type CustomRules = "required"

/**
 * 表单项组件 placeholder 属性接口
 *
 * 用于 FormItem 组件的 props 定义，继承自 ComponentsProps 并添加 placeholder 属性。
 */
export interface ColumnComponentsProps extends ComponentsProps {
  placeholder?: DynamicProp<string>
}

/** 动态属性已解析为静态值的 component Props */
export interface ProcessedColumnComponentsProps extends ColumnComponentsProps {
  placeholder?: string
}

/** FormItem 组件 Props */
export type FormItemProps = Omit<SchemaBaseColumn, "componentProps" | "componentType"> & {
  componentType: string
}

/** 动态属性已解析为静态值的 FormItem Props */
export type ProcessedFormItemProps = Omit<
  SchemaBaseColumn,
  "required" | "readonly" | "disabled" | "hidden" | "componentType"
> & {
  componentType: string
  required: boolean
  readonly: boolean
  disabled: boolean
  hidden: boolean
  componentProps: ProcessedColumnComponentsProps
  class?: string
}

/**
 * 基础字段配置
 */
export interface SchemaBaseColumn<
  T extends FormValues = FormValues,
  K extends keyof RendererPropsMap = keyof RendererPropsMap,
> {
  /** 字段名（支持嵌套路径如 'user.name'） */
  name: NamePath<T>
  /** 字段标签 */
  label?: string
  /** 组件类型 */
  componentType: K
  /** 组件属性（根据 componentType 自动收窄类型，支持函数形式） */
  componentProps?: DynamicProp<RendererPropsMap[K]>
  /** 占位符（支持函数形式） */
  placeholder?: DynamicProp<string>
  /** 是否必填（支持函数形式） */
  required?: DynamicProp<boolean>
  /** 是否只读（支持函数形式） */
  readonly?: DynamicProp<boolean>
  /** 是否禁用（支持函数形式） */
  disabled?: DynamicProp<boolean>
  /** 是否隐藏（支持函数形式） */
  hidden?: DynamicProp<boolean>
  /** 初始值 */
  initialValue?: FormValues
  /** 校验规则（Zod schema） */
  rules?: ZodType | CustomRules
  /** 自定义类名 */
  className?: string
  /** 标签图标 */
  labelIcon?: string
  /** 表单label排列方向 */
  labelAlign?: "left" | "right" | "top"
  /** 表单label宽度 */
  labelWidth?: string
  /** 对齐方式 */
  contentAlign?: "left" | "center" | "right"
  /** 默认的验证触发时机 */
  validationTrigger?: ValidationTrigger | ValidationTrigger[]
  /** 是否在 label 后面添加冒号 */
  colon?: boolean
  /** 自定义样式 */
  style?: CSSProperties
}

/**
 * 嵌套字段配置
 */
export interface SchemaNestedColumn<T extends FormValues = FormValues> {
  // /** 字段名（支持嵌套路径如 'user.name'） */
  // label: string
  /** 组件类型（固定为 dependency） */
  componentType: "columns"
  /** 嵌套列配置 */
  columns: SchemaColumn<T>[]
}
/**
 * 分组字段配置
 */
export interface SchemaGroupColumn<T extends FormValues = FormValues> {
  /** 字段标签 */
  label: string
  /** 组件类型（固定为 dependency） */
  componentType: "group"
  /** 嵌套列配置 */
  columns: SchemaColumn<T>[]
  /** 是否可折叠 */
  collapsible?: boolean
  /** 默认是否折叠 */
  defaultCollapsed?: boolean
}

/**
 * 依赖字段配置
 */
export interface SchemaDependencyColumn<T extends FormValues = FormValues> {
  /** 组件类型（固定为 dependency） */
  componentType: "dependency"
  /** 依赖字段 */
  to: NamePath<T>[]
  /** 渲染函数 */
  renderer: (
    values: FormValues,
    form: SchemaFormInstance
  ) => SchemaColumn[] | Promise<SchemaColumn[]>
}

/**
 * 基础字段配置的分布式联合类型
 *
 * 将每个 componentType 展开为独立的 SchemaBaseColumn 变体，
 * 使 columns 数组中每个元素根据 componentType 获得精确的 componentProps 类型推断。
 */
export type SchemaBaseColumnUnion<T extends FormValues = FormValues> = {
  [K in keyof RendererPropsMap]: SchemaBaseColumn<T, K>
}[keyof RendererPropsMap]

/**
 * 字段配置联合类型
 */
export type SchemaColumn<T extends FormValues = FormValues> =
  | SchemaBaseColumnUnion<T>
  | SchemaNestedColumn<T>
  | SchemaGroupColumn<T>
  | SchemaDependencyColumn<T>
/**
 * 规范化后的基础字段配置
 * SchemaParser 解析后的结果，包含完整路径和原始配置引用
 */

export interface NormalizedSchemaBaseColumn extends SchemaBaseColumn {
  /** 完整路径（由 SchemaParser 生成） */
  path: string
  /** 原始配置引用 */
  _raw: SchemaBaseColumn
}

/**
 * 规范化后的嵌套字段配置
 */
export interface NormalizedSchemaNestedColumn extends SchemaNestedColumn {
  /** 完整路径（由 SchemaParser 生成） */
  path: string
  /** 原始配置引用 */
  _raw: SchemaGroupColumn
}

/**
 * 规范化后的分组字段配置
 */
export interface NormalizedSchemaGroupColumn extends SchemaGroupColumn {
  /** 完整路径（由 SchemaParser 生成） */
  path: string
  /** 原始配置引用 */
  _raw: SchemaGroupColumn
}

/**
 * 规范化后的依赖字段配置
 */
export interface NormalizedSchemaDependencyColumn extends SchemaDependencyColumn {
  /** 原始配置引用 */
  _raw: SchemaDependencyColumn
}

/**
 * 规范化后的字段配置（联合类型）
 */
export type NormalizedSchemaColumn =
  | NormalizedSchemaBaseColumn
  | NormalizedSchemaNestedColumn
  | NormalizedSchemaGroupColumn
  | NormalizedSchemaDependencyColumn

/**
 * 处理后的列配置（联合类型）
 */
export type ProcessedColumnConfig = ProcessedFormItemProps | SchemaDependencyColumn

// ============================================================================
// 组件 Props 类型
// ============================================================================

/** SchemaForm 组件 Props */
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
  /** 默认的验证触发时机 */
  validationTrigger?: ValidationTrigger | ValidationTrigger[]
  /** 标签图标 */
  labelIcon?: string
  /** 表单label排列方向 */
  labelAlign?: "left" | "right" | "top"
  /** 表单label宽度 */
  labelWidth?: string
  /** 表单Content排列方向 */
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
}

// ============================================================================
// 渲染器工厂类型
// ============================================================================

/** 渲染器映射类型 */
export type RendererMap = Record<string, Component>

/** 渲染器上下文接口 */
export interface RendererContext {
  /** 组件属性 */
  props: Record<string, unknown>
  /** 透传属性 */
  attrs: Record<string, unknown>
  /** 插槽 */
  slots: Record<string, unknown>
  /** 状态 */
  state: {
    readonly: boolean
    disabled: boolean
    error: string[] | undefined
  }
  /** 操作方法 */
  actions: {
    onChange: (value: unknown) => void
    onBlur: () => void
  }
  /** 表单上下文 */
  formContext: SchemaFormInstance | undefined
}

/**
 * 全局状态配置
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GolbalContext extends Pick<
  SchemaFormProps,
  "readonly" | "disabled" | "validationTrigger"
> {}
