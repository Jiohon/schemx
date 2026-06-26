/**
 * Runtime Graph - 类型定义
 *
 * 定义 Runtime Graph 装配、诊断和公共门面所需的类型。
 *
 * @module core/runtimeGraph/types
 */

import type {
  SchemxFormApi,
  SchemxInstance,
  Values,
} from "../types/form"
import type { SchemxSchemasInput as SchemxJsonSchemas } from "../createSchemas"
import type { SchemaGraphStore } from "../schemaGraph/types"
import type { ValueGraph } from "../valueGraph/types"
import type { DynamicPropsEngine } from "../dynamicProps/types"
import type { DynamicSlotEngine } from "../dynamicSlot/types"
import type { EffectiveSchemaLayer } from "../effectiveSchema/types"
import type { ValidationEngine } from "../validation/types"
import type { RuntimeScopeManager } from "../runtimeScope/types"
import type { ViewGraph } from "../view/viewGraphTypes"

/**
 * Runtime Graph 创建选项。
 */
export interface CreateRuntimeGraphOptions<TValues extends Values = Values> {
  /** 只读 jsonSchemas 输入 */
  jsonSchemas?: SchemxJsonSchemas<TValues>
  /** 初始值 */
  initialValues?: Partial<TValues>
  /** 表单默认配置 */
  defaultProps?: Record<string, unknown>
}

/**
 * Runtime Graph - 一次表单运行时的核心装配。
 *
 * 持有各领域实例，编排内部流转，聚合诊断信息，但不暴露内部 store。
 */
export interface RuntimeGraph<TValues extends Values = Values> {
  /** Schema Graph Store - 结构事实 */
  readonly schemaGraph: SchemaGraphStore<TValues>
  /** Value Graph - 值事实 */
  readonly valueGraph: ValueGraph<TValues>
  /** Dynamic Props Engine - 动态属性引擎 */
  readonly dynamicProps: DynamicPropsEngine<TValues>
  /** Dynamic Slot Engine - 动态子树引擎 */
  readonly dynamicSlot: DynamicSlotEngine<TValues>
  /** Effective Schema Layer - 有效 schema 层 */
  readonly effectiveSchema: EffectiveSchemaLayer<TValues>
  /** Validation Engine - 校验引擎 */
  readonly validation: ValidationEngine<TValues>
  /** Runtime Scope Manager - 生命周期管理器 */
  readonly scopeManager: RuntimeScopeManager
  /** View Graph - 视图投影 */
  readonly viewGraph: ViewGraph<TValues>
  /** 诊断信息聚合 */
  readonly diagnostics: RuntimeDiagnostics<TValues>

  /**
   * 替换整个 schema 输入。
   *
   * @param nextSchemas - 新的只读 jsonSchemas
   */
  setSchemas(nextSchemas: SchemxJsonSchemas<TValues>): void

  /**
   * 设置字段值。
   *
   * @param name - 字段路径
   * @param value - 新值
   */
  setFieldValue<TName extends keyof TValues>(
    name: TName,
    value: TValues[TName] | undefined
  ): void

  /**
   * 获取字段值。
   *
   * @param name - 字段路径
   * @returns 当前值
   */
  getFieldValue<TName extends keyof TValues>(
    name: TName
  ): TValues[TName] | undefined

  /**
   * 触发表单校验。
   *
   * @returns 校验结果
   */
  validate(): Promise<boolean>

  /**
   * 销毁表单，释放所有资源。
   */
  destroy(): void
}

/**
 * Runtime Diagnostics - 运行时诊断信息聚合。
 *
 * 用于开发调试、性能观察和问题定位。
 */
export interface RuntimeDiagnostics<TValues extends Values = Values> {
  /** Schema 输入错误 */
  readonly schemaErrors: readonly SchemaInputError[]
  /** 动态属性计算错误 */
  readonly dynamicPropsErrors: readonly DynamicPropsError<TValues>[]
  /** Dynamic Slot 过期运行记录 */
  readonly staleSlotRuns: readonly StaleSlotRun[]
  /** 节点生命周期释放记录 */
  readonly disposalRecords: readonly DisposalRecord[]
  /** 视图重新计算来源追踪 */
  readonly viewRecomputationTraces: readonly ViewRecomputationTrace[]
}

/**
 * Schema 输入错误。
 */
export interface SchemaInputError {
  /** 错误类型 */
  readonly type: "invalid_node" | "duplicate_key" | "missing_path" | "invalid_schema"
  /** 错误位置 */
  readonly location?: string
  /** 错误路径 */
  readonly path?: readonly string[]
  /** 错误信息 */
  readonly message: string
}

/**
 * 动态属性计算错误。
 */
export interface DynamicPropsError<TValues extends Values = Values> {
  /** 出错的节点 ID */
  readonly nodeId: string
  /** 依赖的触发字段 */
  readonly triggerFields?: readonly (keyof TValues)[]
  /** 错误信息 */
  readonly message: string
  /** 错误堆栈（开发环境） */
  readonly stack?: string
}

/**
 * Stale Slot Run - 过期的 Dynamic Slot 运行记录。
 */
export interface StaleSlotRun {
  /** Slot 节点 ID */
  readonly slotNodeId: string
  /** 运行 ID */
  readonly runId: number
  /** 过期原因 */
  readonly reason: "newer_run" | "slot_disposed" | "form_destroyed"
}

/**
 * Disposal Record - 节点释放记录。
 */
export interface DisposalRecord {
  /** 节点 ID */
  readonly nodeId: string
  /** 节点类型 */
  readonly nodeType: "field" | "group" | "dynamic_slot"
  /** 释放时间 */
  readonly timestamp: number
  /** 释放原因 */
  readonly reason: "schema_replacement" | "slot_children_replaced" | "form_destroyed"
}

/**
 * View Recomputation Trace - 视图重新计算来源追踪。
 */
export interface ViewRecomputationTrace {
  /** 被追踪的节点 ID（或 root） */
  readonly nodeId: string | "root"
  /** 触发来源 */
  readonly triggeredBy: "field_value" | "dynamic_props" | "schema_change" | "validation"
  /** 触发时间 */
  readonly timestamp: number
  /** 相关字段路径（如果有） */
  readonly relatedField?: string
}

/**
 * Form Facade - 公共表单门面。
 *
 * 对外暴露稳定的 API，屏蔽内部 graph 细节。
 */
export type FormFacade<TValues extends Values = Values> =
  SchemxInstance<TValues> & {
    /**
     * 内部使用：获取表单 API（传递给动态 slot renderer）。
     */
    readonly formApi: SchemxFormApi<TValues>
  }
