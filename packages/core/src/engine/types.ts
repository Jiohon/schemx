/**
 * Runtime engine 共享类型。
 *
 * Engine 层承载具体执行逻辑，但不拥有 RuntimeEngine 装配入口。这里的类型
 * 只描述 engine 所需的窄能力，避免各 engine 直接依赖过宽的 runtime 实现。
 *
 * @module core/engine/types
 */

import type { FormRuntimeContext } from "../core"
import type { RulesRegistry } from "../registry"
import type { FieldRuntimeNode, RuntimeFieldDefaultProps, RuntimeNode } from "../runtime"
import type { DependencyScheduler, RuntimeScheduler } from "../scheduler"
import type { SchemxBaseField, SchemxField, SchemxInstance, Values } from "../types"
import type { Validator } from "../validator"

/** engine 挂载后返回的释放函数。 */
export type EngineDispose = () => void

/**
 * engine 挂载结果。
 *
 * 当前所有 engine 都以显式 dispose 作为生命周期边界，避免调用方直接感知
 * 内部 effect、scheduler job 或 renderer runner。
 */
export interface EngineMountResult {
  /** 释放该 engine 本次 mount 注册的所有资源。 */
  dispose: EngineDispose
}

/** 通知 RuntimeIdleTracker pending 任务数量变化。 */
export type EnginePendingChangeHandler = (delta: number) => void

/** 通知 RuntimeEngine projection/revision 需要刷新。 */
export type EngineTreeChangeHandler = () => void

/**
 * engine 层共享上下文。
 *
 * 这是早期规划时预留的窄接口集合；具体 engine 当前更偏向使用各自 options。
 * 保留该类型用于后续把执行器统一装配时复用。
 */
export interface EngineContext<T extends Values = Values> {
  /** 当前表单实例，供 engine 读取字段值、快照和注册 effect。 */
  form: SchemxInstance<T>
  /** runtime 与 createForm 的生命周期边界。 */
  formRuntimeContext: FormRuntimeContext<T>
  /** 当前阶段仍使用 dependency scheduler，后续会由 RuntimeScheduler 替换。 */
  scheduler: DependencyScheduler<T>
  /** 编译 dependency renderer 返回的 subtree schemas。 */
  compileChildren: (
    previous: RuntimeNode<T>[],
    schemas: SchemxField<T>[],
    parent: RuntimeNode<T> | null,
    ownerPath: string
  ) => RuntimeNode<T>[]
  /** 通知 runtime idle tracker 有异步工作开始或结束。 */
  onPendingChange: EnginePendingChangeHandler
  /** 通知 runtime tree/projection revision 变化。 */
  onTreeChange: EngineTreeChangeHandler
}

export interface DynamicPropEngineOptions<T extends Values = Values> {
  /** 当前表单实例，用于读取依赖字段、快照和注册 effect。 */
  form: SchemxInstance<T>
  /** 解析字段级默认值，通常来自框架层全局 readonly/disabled 等配置。 */
  resolveDefaults: (schema: SchemxBaseField<T>) => RuntimeFieldDefaultProps<T>
  /** 通知 runtime idle tracker 有异步解析开始或结束。 */
  onPendingChange: EnginePendingChangeHandler
  /** runtime 统一调度器，用于 dynamic prop 等 engine 任务去重排队。 */
  scheduler: RuntimeScheduler
  /** 字段已解析属性变化后同步 createForm 生命周期。 */
  onFieldUpdate: (node: FieldRuntimeNode<T>) => void
  /** 字段投影发生变化，通知 engine 版本更新。 */
  onTreeChange: EngineTreeChangeHandler
}

export interface DynamicPropEngineMountResult extends EngineMountResult {}

export interface ValidationEngineOptions<T extends Values = Values> {
  /** 表单校验器实例。 */
  validator: Validator<T>
  /** rules 注册中心，用于把 schema.rules 解析为 StandardSchema。 */
  rulesRegistry: RulesRegistry<T>
  /** 读取字段当前快照，初始化 initialValue 时避免覆盖已有值。 */
  getFieldSnapshot: (name: SchemxBaseField<T>["name"]) => unknown
  /** 写入 initialValues，保持 reset 语义一致。 */
  setInitialValues: (values: Partial<T>) => void
  /** 写入字段值，通常只在字段首次 mount 且声明 initialValue 时调用。 */
  setFieldValue: (name: SchemxBaseField<T>["name"], value: unknown) => void
}
