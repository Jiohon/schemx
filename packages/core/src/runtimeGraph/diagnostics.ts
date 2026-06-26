/**
 * Runtime Diagnostics - 诊断信息聚合
 *
 * @module core/runtimeGraph/diagnostics
 */

import type {
  RuntimeDiagnostics,
  SchemaInputError,
  DynamicPropsError,
  StaleSlotRun,
  DisposalRecord,
  ViewRecomputationTrace,
} from "./types"
import type { Values } from "../types"

/**
 * Runtime Diagnostics 实现。
 */
export class RuntimeDiagnosticsImpl<TValues extends Values = Values>
  implements RuntimeDiagnostics<TValues>
{
  private _schemaErrors: SchemaInputError[] = []
  private _dynamicPropsErrors: DynamicPropsError<TValues>[] = []
  private _staleSlotRuns: StaleSlotRun[] = []
  private _disposalRecords: DisposalRecord[] = []
  private _viewRecomputationTraces: ViewRecomputationTrace[] = []

  get schemaErrors(): readonly SchemaInputError[] {
    return this._schemaErrors
  }

  get dynamicPropsErrors(): readonly DynamicPropsError<TValues>[] {
    return this._dynamicPropsErrors
  }

  get staleSlotRuns(): readonly StaleSlotRun[] {
    return this._staleSlotRuns
  }

  get disposalRecords(): readonly DisposalRecord[] {
    return this._disposalRecords
  }

  get viewRecomputationTraces(): readonly ViewRecomputationTrace[] {
    return this._viewRecomputationTraces
  }

  /**
   * 添加 schema 输入错误。
   */
  addSchemaError(error: SchemaInputError): void {
    this._schemaErrors.push(error)
  }

  /**
   * 添加动态属性错误。
   */
  addDynamicPropsError(error: DynamicPropsError<TValues>): void {
    this._dynamicPropsErrors.push(error)
  }

  /**
   * 记录 stale slot run。
   */
  recordStaleSlotRun(run: StaleSlotRun): void {
    this._staleSlotRuns.push(run)
    // 保留最近 100 条
    if (this._staleSlotRuns.length > 100) {
      this._staleSlotRuns.shift()
    }
  }

  /**
   * 记录节点释放。
   */
  recordDisposal(record: DisposalRecord): void {
    this._disposalRecords.push(record)
  }

  /**
   * 记录视图重新计算。
   */
  recordViewRecomputation(trace: ViewRecomputationTrace): void {
    this._viewRecomputationTraces.push(trace)
    // 保留最近 100 条记录
    if (this._viewRecomputationTraces.length > 100) {
      this._viewRecomputationTraces.shift()
    }
  }

  /**
   * 清空所有诊断信息。
   */
  clear(): void {
    this._schemaErrors = []
    this._dynamicPropsErrors = []
    this._staleSlotRuns = []
    this._disposalRecords = []
    this._viewRecomputationTraces = []
  }
}

/**
 * 创建 RuntimeDiagnostics 实例。
 */
export function createRuntimeDiagnostics<
  TValues extends Values = Values
>(): RuntimeDiagnosticsImpl<TValues> {
  return new RuntimeDiagnosticsImpl<TValues>()
}
