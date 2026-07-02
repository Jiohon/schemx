/**
 * Descriptor 类型定义。
 *
 * Descriptor 是 schema 编译后的运行时输入事实源：它描述结构、稳定身份和
 * 运行期需要挂载的领域能力，但不持有 signal、scope、view state 或 effect state。
 *
 * @module core/descriptor/types
 */

import type {
  NamePath,
  SchemxBaseField,
  SchemxDependencies,
  SchemxDependencyField,
  SchemxField,
  SchemxFormApi,
  SchemxGroupField,
  SchemxRendererKey,
  SchemxResolvedBaseField,
  SchemxResolvedGroupField,
  SchemxRules,
  ValidationTrigger,
  Values,
} from "../types"

/**
 * 表单描述符，所有描述符类型的联合类型。
 *
 * 描述符树表示 schema 编译后的运行时输入事实源，在 node 实例化之前。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段名路径类型。
 */
export type FormDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> =
  | FieldDescriptor<TValues>
  | GroupDescriptor<TValues, TName>
  | DependencyDescriptor<TValues, TName>

/**
 * descriptor 支持的节点类型。
 */
export type DescriptorType = "field" | "group" | "dependency"

/**
 * descriptor 共享字段。
 */
export interface BaseDescriptor<TValues extends Values = Values> {
  /** descriptor 类型。 */
  readonly type: DescriptorType
  /** 用于 keyed reconcile 的稳定 key。 */
  readonly key: string
  /** 用户扩展元信息；runtime 内核不解释具体语义。 */
  readonly meta?: DescriptorMeta<TValues> | null
}

/**
 * 用户扩展元信息。
 */
export interface DescriptorMeta<TValues extends Values = Values> {
  readonly [key: string]: unknown
  /** 原始 schema 引用；仅用于调试或高级扩展，不应被运行时修改。 */
  readonly rawSchema?: SchemxField<TValues>
}

/**
 * 字段描述符，描述单个表单字段。
 *
 * 包含：
 * - 身份：key/name/componentType 用于协调、字段定位和渲染器匹配
 * - 静态 schema：staticSchema 是规范化后的字段 schema
 * - 动态属性：dynamicProps 描述字段属性动态覆盖的来源
 * - 校验：validation 描述字段校验资源
 *
 * @typeParam TValues - 表单值类型。
 */
export interface FieldDescriptor<
  TValues extends Values = Values,
> extends BaseDescriptor<TValues> {
  readonly type: "field"
  /** 字段在表单值对象中的名称路径。 */
  readonly name: NamePath<TValues>
  /** 字段渲染器类型。 */
  readonly componentType: SchemxRendererKey
  /** 编译后、已补默认值的静态字段 schema。 */
  readonly staticSchema: SchemxResolvedBaseField<TValues>
  /** 字段动态属性描述；不存在时字段只使用静态 schema。 */
  readonly dynamicProps?: FieldDynamicPropsDescriptor<TValues> | null
  /** 字段校验描述；不存在时字段不挂载校验资源。 */
  readonly validation?: FieldValidationDescriptor<TValues> | null
}

/**
 * 字段动态属性描述。
 *
 * 这里保持对当前 `SchemxDependencies` API 的引用，不在 descriptor 层
 * 另造一套 `MaybeDynamic` DSL。后续如果引入自动依赖追踪，可以在
 * DynamicProps 领域内部扩展，而不是污染 schema 编译产物。
 */
export interface FieldDynamicPropsDescriptor<TValues extends Values = Values> {
  /** 动态属性来源。 */
  readonly source: "dependencies"
  /** 触发动态属性重算的字段。 */
  readonly triggerFields: readonly NamePath<TValues>[]
  /** 原始 dependencies 配置，供 DynamicProps 运行态消费。 */
  readonly dependencies: SchemxDependencies<TValues>
}

/**
 * 字段校验描述。
 */
export interface FieldValidationDescriptor<_TValues extends Values = Values> {
  /** 校验触发方式。 */
  readonly trigger?: ValidationTrigger | readonly ValidationTrigger[]
  /** 静态校验规则。 */
  readonly rules: SchemxRules | readonly SchemxRules[]
}

/**
 * 分组描述符，描述一组字段或嵌套分组。
 *
 * 分组是结构性容器，没有字段状态。用于布局和组织目的。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段名路径类型。
 */
export interface GroupDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> extends BaseDescriptor<TValues> {
  readonly type: "group"
  /** 编译后、已补默认值的分组 schema。 */
  readonly staticSchema: SchemxResolvedGroupField<TValues>
  /** 分组内的子描述符树。 */
  readonly children: readonly FormDescriptor<TValues, TName>[]
}

/**
 * 依赖描述符，描述由 dependency schema 生成的动态子树。
 *
 * 外部 `componentType: "dependency"` schema 会被编译为该描述符。
 * 当 trigger 字段变化时，render 函数被调用，返回新的 schema，再由 commit 边界前编译。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段名路径类型。
 */
export interface DependencyDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> extends BaseDescriptor<TValues> {
  readonly type: "dependency"
  /** 触发 dependency renderer 重新执行的字段名路径列表。 */
  readonly triggerFields: readonly TName[]
  /** 根据当前表单状态动态生成子 schema 的渲染函数。 */
  readonly renderer: DependencyRenderer<TValues>
}

/**
 * dependency 描述符渲染函数，动态生成子 schema。
 *
 * @typeParam TValues - 表单值类型。
 * @param formApi - 表单 API，用于读取和操作当前表单。
 * @param abortSignal - 中止信号，用于取消过期渲染。
 * @returns 子树的 schema 数组。
 */
export type DependencyRenderer<TValues extends Values = Values> = (
  formApi: SchemxFormApi<TValues>,
  abortSignal: AbortSignal
) => Promise<SchemxField<TValues>[]> | SchemxField<TValues>[]

/**
 * 创建字段 descriptor 的选项。
 */
export interface CreateFieldDescriptorOptions<TValues extends Values = Values> {
  readonly schema: SchemxBaseField<TValues>
  readonly parentKey?: string
}

/**
 * 创建分组 descriptor 的选项。
 */
export interface CreateGroupDescriptorOptions<TValues extends Values = Values> {
  readonly schema: SchemxGroupField<TValues>
  readonly index: number
  readonly parentKey?: string
}

/**
 * 创建 dependency descriptor 的选项。
 */
export interface CreateDependencyDescriptorOptions<TValues extends Values = Values> {
  readonly schema: SchemxDependencyField<TValues>
  readonly parentKey?: string
}

/**
 * 创建任意 descriptor 的选项。
 */
export interface CreateDescriptorOptions<TValues extends Values = Values> {
  readonly schema: SchemxField<TValues>
  readonly index: number
  readonly parentKey?: string
}
