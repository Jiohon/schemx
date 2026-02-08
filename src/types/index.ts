/**
 * 类型定义模块
 *
 * 本模块是类型的统一出口，分为以下几类：
 * 1. 基础类型 - FormValues, DynamicProp 等
 * 2. 表单核心类型 - SchemaFormInstance, ColumnConfig 等
 * 3. 渲染器类型 - ISchemaRegistry, RendererOptions 等
 * 4. 插件系统类型 - Plugin, PluginContext 等
 * 5. 重导出类型 - 从 core/hooks/renderer 模块重导出
 *
 * @module types
 */

import type { Component, CSSProperties } from "vue"

import type { ParsedSchema } from "../core"
import type { FieldSubscribeCallback, GlobalSubscribeCallback } from "../core/Subscriber"
import type { ValidateError, ValidateResult } from "../core/Validator"
import type { ISchemaRegistry } from "../renderer/createRegistry"
import type { DefaultRendererType } from "../renderer/defaultRenderers"
import type { ZodType } from "zod"

// 表单值类型
export type FormValues = Record<string, unknown>

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
 * declare module '@anthropic/schema-form' {
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
export type RendererType = DefaultRendererType | keyof CustomRendererTypes | "dependency"

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
export type DynamicProp<T> = (values: FormValues) => T | T

// ============================================================================
// 表单核心类型
// ============================================================================

/**
 * 表单实例接口
 *
 * 定义表单的所有操作方法，是 useForm 返回值的基础接口。
 * UseFormReturn 继承此接口并添加响应式状态。
 */
export interface SchemaFormInstance<T extends FormValues = FormValues> {
  schema: ParsedSchema | null
  // ==================== 值操作 ====================
  /** 设置单个字段值 */
  setFieldValue: (name: string, value: unknown) => void
  /** 批量设置字段值 */
  setFieldsValue: (values: Partial<T>) => void
  /** 获取单个字段值 */
  getFieldValue: (name: string) => unknown
  /** 获取多个字段值，不传参数返回所有值 */
  getFieldsValue: (names?: string[]) => Record<string, unknown>
  /** 获取字段初始值 */
  getInitialValue: (name: string) => unknown

  // ==================== 校验 ====================
  /** 注册字段校验规则 */
  registerRules: (name: string, rules: ZodType) => void
  /** 注销字段校验规则 */
  unregisterRules: (name: string) => void
  /** 校验指定字段，可选指定字段名数组，成功返回 values，失败返回 errors */
  validateField: (names: string | string[]) => Promise<ValidateResult<T>>
  /** 校验表单，可选指定字段名数组，成功返回 values，失败返回 errors */
  validate: () => Promise<ValidateResult<T>>

  /** 获取单个字段的错误信息 */
  getFieldError: (name: string) => string[] | undefined
  /** 设置字段的错误信息 */
  setFieldError: (name: string, errors: string[]) => void

  // ==================== 提交 ====================
  /** 提交表单 */
  submit: () => Promise<void>

  // ==================== 重置 ====================
  /** 重置整个表单到初始值 */
  reset: () => void
  /** 重置指定字段到初始值 */
  resetFields: (names: string[]) => void

  // ==================== Touched 状态（字段是否被修改） ====================
  /** 检查单个字段是否被修改 */
  isFieldTouched: (name: string) => boolean
  /** 检查多个字段是否被修改，不传参检查是否有任一字段被修改 */
  isFieldsTouched: (names?: string[]) => boolean
  /** 获取所有被修改的字段名 */
  getTouchedFields: () => string[]

  // ==================== 订阅 ====================
  /** 订阅单个字段变化 */
  subscribe: (name: string, callback: FieldSubscribeCallback) => () => void
  /** 订阅所有字段变化 */
  subscribeAll: (callback: GlobalSubscribeCallback) => () => void

  // ==================== Schema 操作 ====================
  /** 更新表单 Schema */
  updateSchema: (columns: ColumnConfig[]) => void
}

/**
 * 字段配置
 */
export type ColumnConfig = BaseColumnConfig | DependencyColumnConfig

/**
 * 基础字段配置
 */
export interface BaseColumnConfig {
  /** 字段名（支持嵌套路径如 'user.name'） */
  name: string
  /** 字段标签 */
  label?: string
  /** 组件类型（不能为 dependency） */
  componentType: Exclude<RendererType, "dependency">
  /** 组件属性（支持函数形式） */
  componentProps?: ComponentsProps | ((values: FormValues) => ComponentsProps)
  /** 校验规则（Zod schema） */
  rules?: ZodType
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
  /** 自定义类名 */
  className?: string
  /** 标签图标 */
  labelIcon?: string
  /** 嵌套列配置 */
  columns?: ColumnConfig[]
  /** 对齐方式 */
  align?: "left" | "center" | "right"
  /** 是否可折叠 */
  collapsible?: boolean
  /** 默认是否折叠 */
  defaultCollapsed?: boolean
}

/**
 * 依赖字段配置
 */
export interface DependencyColumnConfig {
  /** 组件类型（固定为 dependency） */
  componentType: "dependency"
  /** 依赖字段 */
  to: string[]
  /** 渲染函数 */
  renderer: (
    values: FormValues,
    form: SchemaFormInstance,
    isDependenceUpdated: boolean
  ) => ColumnConfig[] | Promise<ColumnConfig[]>
}

/**
 * 规范化后的基础字段配置
 * SchemaParser 解析后的结果，包含完整路径和原始配置引用
 */
export interface NormalizedBaseColumnConfig extends BaseColumnConfig {
  /** 完整路径（由 SchemaParser 生成） */
  path: string
  /** 原始配置引用 */
  _raw: ColumnConfig
}

/**
 * 规范化后的依赖字段配置
 */
export interface NormalizedDependencyColumn extends DependencyColumnConfig {
  /** 原始配置引用 */
  _raw: ColumnConfig
}

/**
 * 规范化后的字段配置（联合类型）
 */
export type NormalizedColumnConfig =
  | NormalizedBaseColumnConfig
  | NormalizedDependencyColumn

/**
 * 处理后的基础列配置
 *
 * 所有动态属性已被解析为静态值
 */
export interface ProcessedBaseColumnConfig extends Omit<
  BaseColumnConfig,
  "componentProps" | "visible" | "hidden" | "disabled" | "readonly" | "required"
> {
  class?: string
  componentProps?: ComponentsProps
  visible?: boolean
  hidden?: boolean
  disabled?: boolean
  readonly?: boolean
  required?: boolean
}

/**
 * 处理后的列配置（联合类型）
 */
export type ProcessedColumnConfig = ProcessedBaseColumnConfig | DependencyColumnConfig

// ============================================================================
// 组件 Props 类型
// ============================================================================

/** SchemaForm 组件 Props */
export interface SchemaFormProps<T extends FormValues = FormValues> {
  /** 表单数据（v-model） */
  modelValue?: T
  /** 初始值 */
  initialValues?: T
  /** 默认的验证触发时机 */
  validationTrigger?: ValidationTrigger | ValidationTrigger[]
  /** 表单字段配置 */
  columns: ColumnConfig[]
  /** 表单实例 */
  form?: SchemaFormInstance
  /** 表单label排列方向 */
  labelAlign?: "left" | "right" | "top"
  /** 表单label宽度 */
  labelWidth?: string
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
  onFinish?: (values: T) => void
  /** 提交失败回调 */
  onFinishFailed?: (errorInfo: ValidateError<T>) => void
  /** 值变化回调 */
  onValuesChange?: (changedValues: Partial<T>, allValues: T) => void
  /** 字段变化回调 */
  onFieldsChange?: (changedFields: string[], allFields: string[]) => void
  /** 是否显示底部按钮 */
  footer?: boolean | object | (() => boolean)
  /** 提交按钮文本 */
  submitButtonText?: string
  /** 提交按钮属性 */
  submitButtonProps?: ComponentsProps
}

/** FormItem 组件 Props */
export interface FormItemProps {
  column: ColumnConfig
  form: SchemaFormInstance
  schemaRenderer: ISchemaRegistry
  readonly?: boolean
}

export interface ComponentsProps {
  className?: string
  style?: CSSProperties
  [key: string]: unknown
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
