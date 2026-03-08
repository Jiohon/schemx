/**
 * Schema 列配置类型
 *
 * 定义表单字段的 Schema 配置结构，包括基础字段、嵌套字段、
 * 分组字段、依赖字段，以及规范化后的配置类型。
 *
 * @module types/schema
 */

import type { CSSProperties } from "vue"

import type {
  CustomRules,
  DynamicProp,
  FormValues,
  NamePath,
  ValidationTrigger,
} from "./base"
import type { SchemaFormInstance } from "./instance"
import type { RendererPropsMap } from "./renderer"
import type { ZodType } from "zod"

/**
 * 基础字段配置
 *
 * 描述单个表单字段的完整配置，包括组件类型、校验规则、动态属性等。
 *
 * @typeParam T - 表单值类型
 * @typeParam K - 组件类型键，用于收窄 componentProps 类型
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
  /** 所依赖的字段，值变化后触发动态属性重新计算 */
  dependencies?: NamePath<T>
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
  /** 校验规则（Zod schema 或快捷方式） */
  rules?: ZodType | CustomRules
  /** 自定义类名 */
  className?: string
  /** 标签图标 */
  labelIcon?: string
  /** 表单 label 排列方向 */
  labelAlign?: "left" | "right" | "top"
  /** 表单 label 宽度 */
  labelWidth?: string
  /** 内容对齐方式 */
  contentAlign?: "left" | "center" | "right"
  /** 验证触发时机 */
  validationTrigger?: ValidationTrigger | ValidationTrigger[]
  /** 是否在 label 后面添加冒号 */
  colon?: boolean
  /** 自定义样式 */
  style?: CSSProperties
}

/**
 * 嵌套字段配置
 *
 * 将多个字段组织为嵌套结构，componentType 固定为 `"columns"`。
 *
 * @typeParam T - 表单值类型
 */
export interface SchemaNestedColumn<T extends FormValues = FormValues> {
  /** 组件类型（固定为 columns） */
  componentType: "columns"
  /** 嵌套列配置 */
  columns: SchemaColumn<T>[]
}

/**
 * 分组字段配置
 *
 * 将多个字段组织为可折叠的分组，componentType 固定为 `"group"`。
 *
 * @typeParam T - 表单值类型
 */
export interface SchemaGroupColumn<T extends FormValues = FormValues> {
  /** 分组标签 */
  label: string
  /** 组件类型（固定为 group） */
  componentType: "group"
  /** 分组内的列配置 */
  columns: SchemaColumn<T>[]
  /** 是否可折叠 */
  collapsible?: boolean
  /** 默认是否折叠 */
  defaultCollapsed?: boolean
}

/**
 * 依赖字段配置
 *
 * 根据其他字段的值动态生成列配置，componentType 固定为 `"dependency"`。
 *
 * @typeParam T - 表单值类型
 */
export interface SchemaDependencyColumn<T extends FormValues = FormValues> {
  /** 组件类型（固定为 dependency） */
  componentType: "dependency"
  /** 依赖的字段路径 */
  to: NamePath<T>[]
  /** 动态列配置生成函数 */
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
 *
 * @typeParam T - 表单值类型
 */
export type SchemaBaseColumnUnion<T extends FormValues = FormValues> = {
  [K in keyof RendererPropsMap]: SchemaBaseColumn<T, K>
}[keyof RendererPropsMap]

/**
 * 字段配置联合类型
 *
 * 表单 columns 数组中每个元素的类型。
 *
 * @typeParam T - 表单值类型
 */
export type SchemaColumn<T extends FormValues = FormValues> =
  | SchemaBaseColumnUnion<T>
  | SchemaNestedColumn<T>
  | SchemaGroupColumn<T>
  | SchemaDependencyColumn<T>

/**
 * 规范化后的基础字段配置
 *
 * SchemaParser 解析后的结果，包含完整路径和原始配置引用。
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
 * 规范化后的字段配置联合类型
 */
export type NormalizedSchemaColumn =
  | NormalizedSchemaBaseColumn
  | NormalizedSchemaNestedColumn
  | NormalizedSchemaGroupColumn
  | NormalizedSchemaDependencyColumn
