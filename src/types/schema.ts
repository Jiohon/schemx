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
  Value,
} from "./base"
import type { SchemaFormInstance } from "./instance"
import type { CustomRendererMap } from "./renderer"
import type { StandardSchemaV1 } from "../core/standardSchema"

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
  K extends keyof CustomRendererMap = keyof CustomRendererMap,
> {
  /**
   * 字段名称
   *
   * 支持嵌套路径语法，如 `'user.name'`、`['user', 'address', 'city']`。
   * 用于在 FormStore 中定位字段值的存取路径。
   */
  name: NamePath<T>

  /**
   * 字段标签文本
   *
   * 显示在表单项左侧的描述文字，不设置时不渲染 label 区域。
   */
  label?: string

  /**
   * 渲染组件类型
   *
   * 对应 CustomRendererMap 中注册的组件键名，
   * 用于从 rendererRegistry 中查找并渲染对应的表单控件。
   */
  componentType: K

  /**
   * 依赖的字段路径
   *
   * 当指定字段的值发生变化时，会触发当前字段的动态属性
   * （如 `componentProps`、`hidden`、`disabled` 等）重新计算。
   */
  dependencies?: NamePath<T>

  /**
   * 传递给渲染组件的属性
   *
   * 类型根据 `componentType` 自动收窄为对应组件的 Props 类型。
   * 支持函数形式 `(values) => props`，在依赖字段变化时动态计算。
   */
  componentProps?: DynamicProp<CustomRendererMap[K]>

  /**
   * 占位提示文本
   *
   * 支持函数形式 `(values) => string`，在依赖字段变化时动态计算。
   */
  placeholder?: DynamicProp<string>

  /**
   * 是否必填
   *
   * 控制必填标记（红色星号）的显示。
   * 若未设置，会根据 `rules` 中的校验规则自动推断。
   * 支持函数形式 `(values) => boolean`，在依赖字段变化时动态计算。
   */
  required?: DynamicProp<boolean>

  /**
   * 是否只读
   *
   * 只读状态下字段可见但不可编辑。
   * 未设置时继承 FormContext 的全局 `readonly` 配置。
   * 支持函数形式 `(values) => boolean`，在依赖字段变化时动态计算。
   */
  readonly?: DynamicProp<boolean>

  /**
   * 是否禁用
   *
   * 禁用状态下字段不可交互。
   * 未设置时继承 FormContext 的全局 `disabled` 配置。
   * 支持函数形式 `(values) => boolean`，在依赖字段变化时动态计算。
   */
  disabled?: DynamicProp<boolean>

  /**
   * 是否隐藏
   *
   * 隐藏时字段不渲染，同时会清除校验规则和错误信息。
   * 支持函数形式 `(values) => boolean`，在依赖字段变化时动态计算。
   */
  hidden?: DynamicProp<boolean>

  /**
   * 字段初始值
   *
   * 组件挂载时写入 FormStore，同时作为 `reset()` 的还原目标。
   */
  initialValue?: Value

  /**
   * 校验规则
   *
   * 支持 StandardSchemaV1 实例（如 Zod、Valibot 等实现了 Standard Schema 接口的验证库）
   * 或内置快捷方式（如 `"required"`）。
   * 校验在 `submit` 或触发时机（`validationTrigger`）到达时执行。
   */
  rules?: StandardSchemaV1 | CustomRules

  /**
   * 自定义 CSS 类名
   *
   * 追加到表单项容器元素上，与内置类名合并。
   */
  className?: string

  /**
   * 标签图标
   *
   * 显示在 label 文本旁的图标标识。
   */
  labelIcon?: string

  /**
   * 标签对齐方式
   *
   * 未设置时继承 FormContext 的全局 `labelAlign` 配置。
   */
  labelAlign?: "left" | "right" | "top"

  /**
   * 标签宽度
   *
   * 未设置时继承 FormContext 的全局 `labelWidth` 配置。
   */
  labelWidth?: string

  /**
   * 内容区域对齐方式
   */
  contentAlign?: "left" | "center" | "right"

  /**
   * 校验触发时机
   *
   * 支持单个或多个触发时机组合，如 `'change'`、`'blur'`、`['change', 'blur']`。
   * 未设置时继承 FormContext 的全局 `validationTrigger` 配置。
   */
  validationTrigger?: ValidationTrigger | ValidationTrigger[]

  /**
   * 是否在标签后显示冒号
   *
   * 未设置时继承 FormContext 的全局 `colon` 配置。
   */
  colon?: boolean

  /**
   * 自定义内联样式
   *
   * 应用到表单项容器元素上。
   */
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
  [K in keyof CustomRendererMap]: SchemaBaseColumn<T, K>
}[keyof CustomRendererMap]

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
