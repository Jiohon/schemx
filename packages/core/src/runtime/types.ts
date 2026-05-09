/**
 * Runtime 节点类型定义
 *
 * 将不可变的 Raw Schema 编译为可变的运行时树节点。
 * RuntimeNode 不直接面向 UI 暴露，主要用于 dependency subtree、生命周期、
 * identity 复用和后续跨框架适配。
 *
 * @module core/runtime/types
 */

import type {
  SchemxBaseField,
  SchemxDependencyField,
  SchemxField,
  SchemxGroupField,
  Values,
} from "../types"
import type { Signal } from "@preact/signals-core"

/**
 * Runtime 节点公共字段。
 *
 * @typeParam T - 表单值类型
 */
export interface RuntimeNodeBase<T extends Values = Values> {
  /** 运行时自增 id，便于调试和框架层 key fallback */
  id: number
  /** 稳定身份 key，由 ownerPath + schema identity 生成 */
  key: string
  /** 父节点，root 节点为 null */
  parent: RuntimeNode<T> | null
  /** 节点是否处于挂载状态 */
  mounted: boolean
  /** 节点是否等待调度器刷新 */
  dirty: boolean
  /** 节点是否已销毁 */
  disposed: boolean
  /** 释放当前节点及其子树持有的订阅和运行时状态 */
  dispose: () => void
}

/**
 * 字段运行时状态。
 *
 * Stage A 先保存 schema 引用；后续 Stage B 会把 validator、errors、
 * visible/disabled 等生命周期状态迁入这里。
 */
export interface FieldRuntime<T extends Values = Values> {
  schema: SchemxBaseField<T>
  /** 当前字段是否已执行 runtime mount 生命周期 */
  mounted: boolean
}

/**
 * 基础字段节点。
 *
 * 对应最终可渲染的表单字段。
 */
export interface FieldRuntimeNode<T extends Values = Values> extends RuntimeNodeBase<T> {
  type: "field"
  schema: SchemxBaseField<T>
  field: FieldRuntime<T>
}

/**
 * 分组节点。
 *
 * 对应 `componentType: "group"`，负责承载静态 children 的运行时子树。
 */
export interface GroupRuntimeNode<T extends Values = Values> extends RuntimeNodeBase<T> {
  type: "group"
  schema: SchemxGroupField<T>
  children: RuntimeNode<T>[]
}

/**
 * 依赖节点。
 *
 * dependency 本质是 Reactive Schema Factory，不是普通字段。
 * 它监听依赖字段变化，执行 renderer，并只替换自己的 subtree。
 */
export interface DependencyRuntimeNode<
  T extends Values = Values,
> extends RuntimeNodeBase<T> {
  type: "dependency"
  schema: SchemxDependencyField<T>
  /** 当前已编译出的 dependency 子树 */
  children: RuntimeNode<T>[]
  /** 响应式子树信号，供 engine 和框架适配层追踪变化 */
  subtree: Signal<RuntimeNode<T>[]>
  /** renderer 执行中状态 */
  loading: Signal<boolean>
  /** renderer 抛出的最近一次错误 */
  error: Signal<unknown | null>
  /** async renderer 版本号，用于丢弃过期结果 */
  version: number
  /** 执行 dependency renderer 并增量编译返回的 subtree */
  run: () => Promise<void>
}

/**
 * Runtime 节点联合类型。
 */
export type RuntimeNode<T extends Values = Values> =
  | FieldRuntimeNode<T>
  | GroupRuntimeNode<T>
  | DependencyRuntimeNode<T>

/**
 * 编译器可接收的 schema 类型。
 */
export type RuntimeSchema<T extends Values = Values> = SchemxField<T>
