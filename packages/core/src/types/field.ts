/**
 * 字段运行时类型定义。
 *
 * FieldRuntime 只保存字段状态，与节点结构（parent/mounted/disposed）分离。
 *
 * @module core/types/field
 */

import type { SchemxDependenciesStaticProps } from "./dependencies"
import type { ReactiveSignal } from "../reactivity"
import type { Values } from "./form"
import type { ReactiveComputation, RuntimeNode, RuntimeNodeBase } from "./runtime"
import type { SchemxBaseField, SchemxComponentProps } from "./schema"

// ---------------------------------------------------------------------------
// 字段已解析属性
// ---------------------------------------------------------------------------

/**
 * 字段运行时默认属性。
 *
 * 合并策略：
 * - `readonly` / `disabled`
 *   default props 作为初始值，schema 静态配置优先级更高，dependencies engine 结果最终覆盖
 */
export type RuntimeFieldDefaultProps<T extends Values = Values> = Partial<
  Pick<SchemxDependenciesStaticProps<T>, "readonly" | "disabled">
>

/**
 * 字段运行时默认属性来源。
 */
export type RuntimeFieldDefaults<T extends Values = Values> =
  | RuntimeFieldDefaultProps<T>
  | ((schema: SchemxBaseField<T>) => RuntimeFieldDefaultProps<T>)

// ---------------------------------------------------------------------------
// FieldRuntime
// ---------------------------------------------------------------------------

/**
 * 字段运行时状态容器。
 *
 * FieldRuntime 只保存字段状态，不保存：
 *
 * - schema
 * - parent
 * - mounted
 * - disposed
 * - dispose
 *
 * 这些生命周期与节点结构相关的信息统一放在 FieldRuntimeNode / RuntimeNodeBase 中。
 *
 * ## 竞态防护
 *
 * 每个可能涉及异步计算的属性（disabled、visible、required、componentProps、rules）
 * 使用独立的 `ReactiveComputation<T>` 容器，各自维护独立的 version 和 AbortController，
 * 避免多个并发 async 计算互相干扰版本号推进。
 *
 * 对于确定只有同步计算的属性（placeholder），直接使用 `ReactiveSignal<T>`。
 *
 * @typeParam T - 表单值类型
 */
export interface FieldRuntime<T extends Values = Values> {
  /**
   * 字段是否可见。
   *
   * 使用独立 computation 容器，支持 async visible 计算防竞态。
   *
   * ## visible=false 时的值语义
   *
   * 默认行为（可通过 schema 配置覆盖）：
   * - `keepValueWhenHidden: false`：字段隐藏时其值从 form data 中移除，submit 时不携带
   * - `validateWhenHidden: false`：字段隐藏时跳过校验
   */
  visible: ReactiveComputation<boolean>

  /**
   * 字段是否只读。
   */
  readonly: ReactiveComputation<boolean>

  /**
   * 字段是否禁用。
   */
  disabled: ReactiveComputation<boolean>

  /**
   * 字段是否必填。
   */
  required: ReactiveComputation<boolean>

  /**
   * 字段占位符。
   *
   * 通常为纯同步计算，直接使用 signal。
   * 若业务场景需要 async placeholder（如 i18n 异步加载），
   * 可将此字段升级为 ReactiveComputation<string>。
   */
  placeholder: ReactiveSignal<string>

  /**
   * 组件透传属性。
   *
   * componentProps 是最常见的 async dependencies 来源（如远程加载 options），
   * 使用独立 computation 容器防竞态。
   */
  componentProps: ReactiveComputation<SchemxComponentProps<T>>

  /**
   * 字段校验规则。
   *
   * rules 支持动态计算（如根据其他字段值切换校验规则），使用独立 computation 容器。
   */
  rules: ReactiveComputation<SchemxBaseField<T>["rules"] | undefined>
}

// ---------------------------------------------------------------------------
// FieldRuntimeNode
// ---------------------------------------------------------------------------

/**
 * 基础字段节点。
 *
 * FieldRuntimeNode 负责承载：
 *
 * - 字段节点身份
 * - 字段 schema
 * - 字段 runtime state
 *
 * 它对应最终可渲染的表单字段。
 */
export interface FieldRuntimeNode<T extends Values = Values> extends RuntimeNodeBase<T> {
  type: "field"

  /**
   * 字段原始 schema。
   *
   * schema 应视为 immutable input，不应在 runtime 中直接修改。
   */
  schema: SchemxBaseField<T>

  /**
   * 字段运行时状态。
   */
  fieldRuntime: FieldRuntime<T>
}

// ---------------------------------------------------------------------------
// 类型守卫
// ---------------------------------------------------------------------------

/**
 * 判断节点是否为字段节点。
 */
export function isFieldRuntimeNode<T extends Values = Values>(
  node: RuntimeNode<T>
): node is FieldRuntimeNode<T> {
  return node.type === "field"
}
