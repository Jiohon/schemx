/**
 * ViewNode 类型定义。
 *
 * ViewNode 是 Adapter 消费的唯一数据结构，是 Fiber Tree 的投影结果。
 * 不暴露 Fiber、Store、DependencyEffectSlot、Schema。
 *
 * @module core/view/types
 */

import type {
  NamePath,
  SchemxResolvedBaseField,
  SchemxRules,
  ValidationTrigger,
} from "../types"

/**
 * ViewNode 类型枚举。
 */
export type ViewNodeType = "field" | "group" | "fragment"

/**
 * 渲染器标识。
 */
export type SchemxRendererKey = string

/**
 * 字段视图属性。
 *
 * 所有属性从字段 normalized schema 投影得出，是不可变的只读快照。
 */
export interface FieldViewProps {
  /**
   * Schema 中声明的组件类型。
   */
  readonly componentType?: string

  /**
   * 字段标签。
   */
  readonly label: string

  /**
   * 是否可见。
   */
  readonly visible: boolean

  /**
   * 是否只读。
   */
  readonly readonly: boolean

  /**
   * 是否禁用。
   */
  readonly disabled: boolean

  /**
   * 是否必填。
   */
  readonly required: boolean

  /**
   * 占位符，最大长度 1000 字符。
   */
  readonly placeholder: string

  /**
   * 组件属性。
   *
   * 键名符合有效的 JavaScript 标识符格式或由字母、数字、下划线、连字符组成。
   * 嵌套深度不超过 10 层。
   */
  readonly componentProps: Readonly<Record<string, unknown>>

  /**
   * 校验规则快照。
   */
  readonly rules?: SchemxRules | SchemxRules[]

  /**
   * 校验触发时机。
   */
  readonly validationTrigger?: ValidationTrigger | ValidationTrigger[]

  readonly labelIcon?: string
  readonly labelAlign?: "left" | "center" | "right"
  readonly labelPosition?: "left" | "top" | "right"
  readonly labelWidth?: string
  readonly contentAlign?: "left" | "center" | "right"
  readonly colon?: boolean
  readonly class?: unknown
  readonly style?: unknown
}

/**
 * 字段状态视图。
 *
 * 从 Store 和 Validator 提取，是不可变的只读快照。
 */
export interface FieldViewState {
  /**
   * 字段值，可为 null 或 undefined。
   */
  readonly value: unknown

  /**
   * 是否已触碰。
   */
  readonly touched: boolean

  /**
   * 异步状态标记，无异步操作时为 null。
   */
  readonly pending: boolean

  /**
   * 错误列表，数组长度不超过 100。
   */
  readonly errors: readonly string[]

  /**
   * 是否正在校验。
   */
  readonly validating: boolean
}

/**
 * Field 类型 ViewNode。
 *
 * 仅当 Fiber 有 FieldModel 且无 DependencyEffectSlot 时投影为此类型。
 */
export interface FieldViewNode {
  /**
   * 唯一标识符，对应 Fiber.id。
   */
  readonly id: number

  /**
   * 节点 key，用于 keyed 渲染。
   */
  readonly key: string

  /**
   * 节点类型。
   */
  readonly type: "field"

  /**
   * 渲染器标识。
   */
  readonly renderer: SchemxRendererKey

  /**
   * 字段 name path。
   */
  readonly name: NamePath

  /**
   * 编译后的静态字段 schema。
   */
  readonly schema: Readonly<SchemxResolvedBaseField>

  /**
   * 计算后的字段属性（只读快照）。
   */
  readonly props: Readonly<FieldViewProps>

  /**
   * 字段状态快照。
   */
  readonly state: Readonly<FieldViewState>

  /**
   * 子节点（field 类型无子节点）。
   */
  readonly children: readonly ViewNode[]

  /**
   * 调试元数据（仅在开发环境且启用调试模式时存在）。
   */
  readonly debug?: Readonly<{
    readonly fiberKind: string
    readonly hasFieldModel: boolean
    readonly hasDependencySlot: boolean
  }>
}

/**
 * Container 类型 ViewNode（group 或 fragment）。
 *
 * Group/Fragment 不包含 renderer、name、state。
 */
export interface ContainerViewNode {
  /**
   * 唯一标识符，对应 Fiber.id。
   */
  readonly id: number

  /**
   * 节点 key，用于 keyed 渲染。
   */
  readonly key: string

  /**
   * 节点类型。
   */
  readonly type: "group" | "fragment"

  /**
   * 计算后的字段属性（只读快照，group/fragment 为空对象）。
   */
  readonly props: Readonly<FieldViewProps>

  /**
   * 子节点。
   */
  readonly children: readonly ViewNode[]

  /**
   * 调试元数据（仅在开发环境且启用调试模式时存在）。
   */
  readonly debug?: Readonly<{
    readonly fiberKind: string
    readonly hasFieldModel: boolean
    readonly hasDependencySlot: boolean
  }>
}

/**
 * Adapter 视图节点（discriminated union）。
 *
 * ViewNode 是 Adapter 唯一消费的数据结构。
 * - 不暴露 Fiber
 * - 不暴露 DependencyEffectSlot
 * - 不暴露 schema 原始对象
 * - 不暴露 mutable Store
 */
export type ViewNode = FieldViewNode | ContainerViewNode
