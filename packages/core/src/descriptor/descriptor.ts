/**
 * 表单描述符类型，用于 schema 编译。
 *
 * 描述符是编译后的中间表示，不持有实例状态。
 * 它们由 schema compiler 生成，被表单内部 graph 消费以创建字段模型。
 *
 * @module core/descriptor/descriptor
 */

import type {
  NamePath,
  SchemxDependencies,
  SchemxField,
  SchemxFormApi,
  SchemxResolvedBaseField,
  SchemxResolvedGroupField,
  SchemxRules,
  ValidationTrigger,
  Values,
} from "../types"

/**
 * 表单描述符，所有描述符类型的联合类型。
 *
 * 描述符树表示 schema 编译后的表单结构，在 graph 实例化之前。
 */
export type FormDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> =
  | FieldDescriptor<TValues>
  | GroupDescriptor<TValues, TName>
  | DependencyDescriptor<TValues, TName>

/**
 * 字段描述符，描述单个表单字段。
 *
 * 包含：
 * - 身份：key 用于协调
 * - Schema：schema 是规范化后的静态字段 schema
 * - Validation：validation 是字段静态校验描述
 * - Dependencies：dependencies 是字段动态派生规则
 */
export interface FieldDescriptor<TValues extends Values = Values> {
  readonly type: "field"
  readonly key: string
  readonly schema: SchemxResolvedBaseField<TValues>
  readonly validation: ValidationDescriptor
  readonly dependencies?: SchemxDependencies<TValues>
}

/**
 * 分组描述符，描述一组字段或嵌套分组。
 *
 * 分组是结构性容器，没有字段状态。
 * 用于布局和组织目的。
 */
export interface GroupDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  readonly type: "group"
  readonly key: string
  readonly schema: SchemxResolvedGroupField<TValues>
  readonly children: FormDescriptor<TValues, TName>[]
}

/**
 * 依赖描述符，描述由 dependency schema 生成的动态子树。
 *
 * 外部 `componentType: "dependency"` schema 会被编译为该描述符。
 * 当 trigger 字段变化时，render 函数被调用，返回新的 schema，再由 commit 边界前编译。
 */
export interface DependencyDescriptor<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  readonly type: "dependency"
  readonly key: string
  readonly trigger: TName[]
  readonly renderer: DependencyRenderer<TValues>
}

/**
 * dependency 描述符渲染函数，动态生成子 schema。
 *
 * @typeParam TValues - 表单值类型
 * @param formApi - 表单 API，用于读取和操作当前表单
 * @param abortSignal - 中止信号，用于取消过期渲染
 * @returns 子树的 schema 数组
 */
export type DependencyRenderer<TValues extends Values = Values> = (
  /**
   * 表单 API，用于程序化操作表单。
   */
  formApi: SchemxFormApi<TValues>,
  /**
   * 中止信号，用于取消渲染器执行。
   */
  abortSignal: AbortSignal
) => Promise<SchemxField<TValues>[]> | SchemxField<TValues>[]

/**
 * 校验描述符，定义字段的校验配置。
 */
export interface ValidationDescriptor {
  /**
   * 字段静态校验规则。
   */
  readonly rules?: SchemxRules | SchemxRules[]

  /**
   * 校验触发时机。
   */
  readonly trigger?: ValidationTrigger | ValidationTrigger[]

  /**
   * 防抖延迟（毫秒）。
   */
  readonly debounce?: number
}

/**
 * 判断是否为字段描述符。
 *
 * @typeParam TValues - 表单值类型
 * @param descriptor - 待判断的表单描述符
 * @returns 字段描述符
 */
export const isFieldDescriptor = <TValues extends Values = Values>(
  descriptor: FormDescriptor<TValues>
): descriptor is FieldDescriptor<TValues> => {
  return descriptor.type === "field"
}

/**
 * 判断是否为分组描述符。
 *
 * @typeParam TValues - 表单值类型
 * @param descriptor - 待判断的表单描述符
 * @returns 分组描述符
 */
export const isGroupDescriptor = <TValues extends Values = Values>(
  descriptor: FormDescriptor<TValues>
): descriptor is GroupDescriptor<TValues> => {
  return descriptor.type === "group"
}

/**
 * 判断是否为 dependency 描述符。
 *
 * @typeParam TValues - 表单值类型
 * @param descriptor - 待判断的表单描述符
 * @returns dependency 描述符
 */
export const isDependencyDescriptor = <TValues extends Values = Values>(
  descriptor: FormDescriptor<TValues>
): descriptor is DependencyDescriptor<TValues> => {
  return descriptor.type === "dependency"
}
