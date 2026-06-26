/**
 * Value Graph - 类型定义
 *
 * 定义字段值、字段元数据和 Value Graph 所需的类型。
 *
 * @module core/valueGraph/types
 */

import type { NodeId } from "../schemaGraph/types"
import type { Values } from "../types/form"

/**
 * Field Value Node - 字段值节点。
 *
 * 持有单个字段的值、初始值和交互元数据。
 */
export interface FieldValueNode<
  TValues extends Values = Values,
  TName extends keyof TValues = keyof TValues
> {
  /** 字段路径 */
  readonly name: TName
  /** 字段值 Signal */
  readonly value: FieldValueSignal<TValues[TName]>
  /** 初始值 Signal */
  readonly initialValue: FieldValueSignal<TValues[TName] | undefined>
  /** touched 状态 Signal */
  readonly touched: FieldMetaSignal<boolean>
  /** dirty 状态（computed） */
  readonly dirty: FieldMetaSignal<boolean>
  /** 错误列表 Signal */
  readonly errors: FieldMetaSignal<readonly string[]>
  /** 校验中状态 Signal */
  readonly validating: FieldMetaSignal<boolean>
}

/**
 * Field Value Signal - 字段值信号。
 *
 * 简化的 Signal 接口，用于字段值读写。
 */
export interface FieldValueSignal<T> {
  /** 当前值 */
  value: T | undefined
}

/**
 * Field Meta Signal - 字段元数据信号。
 */
export interface FieldMetaSignal<T> {
  /** 当前值 */
  value: T
}

/**
 * Value Graph Snapshot - Value Graph 的快照状态。
 */
export interface ValueGraphSnapshot<TValues extends Values = Values> {
  /** 当前表单值 */
  readonly values: TValues
  /** touched 状态 */
  readonly touched: Readonly<Partial<Record<keyof TValues, boolean>>>
  /** dirty 状态 */
  readonly dirty: Readonly<Partial<Record<keyof TValues, boolean>>>
  /** 错误状态 */
  readonly errors: Readonly<Partial<Record<keyof TValues, readonly string[]>>>
  /** 校验中状态 */
  readonly validating: Readonly<Partial<Record<keyof TValues, boolean>>>
}

/**
 * Value Graph - 字段值事实存储。
 *
 * 管理字段值、初始值、dirty、touched、errors、validating 等字段元数据。
 * 在 schema replacement 时保留同 identity 字段的值和状态。
 */
export interface ValueGraph<TValues extends Values = Values> {
  /**
   * 获取当前快照。
   */
  readonly snapshot: ValueGraphSnapshot<TValues>

  /**
   * 确保字段节点存在（mount 时调用）。
   *
   * @param nodeId - 节点 ID
   * @param name - 字段路径
   * @param initialValue - 初始值（如果有）
   * @returns 字段值节点
   */
  mountField<TName extends keyof TValues>(
    nodeId: NodeId,
    name: TName,
    initialValue?: TValues[TName]
  ): FieldValueNode<TValues, TName>

  /**
   * 获取字段节点（如果已 mount）。
   *
   * @param nodeId - 节点 ID
   * @returns 字段值节点
   */
  getField(nodeId: NodeId): FieldValueNode<TValues> | undefined

  /**
   * 通过字段路径获取字段节点。
   *
   * @param name - 字段路径
   * @returns 字段值节点
   */
  getFieldByName<TName extends keyof TValues>(
    name: TName
  ): FieldValueNode<TValues, TName> | undefined

  /**
   * 设置字段值。
   *
   * @param name - 字段路径
   * @param value - 新值
   */
  setValue<TName extends keyof TValues>(
    name: TName,
    value: TValues[TName] | undefined
  ): void

  /**
   * 获取字段值。
   *
   * @param name - 字段路径
   * @returns 当前值
   */
  getValue<TName extends keyof TValues>(
    name: TName
  ): TValues[TName] | undefined

  /**
   * 设置字段错误。
   *
   * @param name - 字段路径
   * @param errors - 错误列表
   */
  setErrors<TName extends keyof TValues>(
    name: TName,
    errors: readonly string[]
  ): void

  /**
   * 设置字段校验中状态。
   *
   * @param name - 字段路径
   * @param validating - 是否校验中
   */
  setValidating<TName extends keyof TValues>(
    name: TName,
    validating: boolean
  ): void

  /**
   * 设置字段 touched 状态。
   *
   * @param name - 字段路径
   * @param touched - 是否 touched
   */
  setTouched<TName extends keyof TValues>(
    name: TName,
    touched: boolean
  ): void

  /**
   * 释放节点。
   *
   * @param nodeId - 节点 ID
   */
  disposeNode(nodeId: NodeId): void

  /**
   * 设置初始值（表单初始化时调用）。
   *
   * @param initialValues - 初始值对象
   */
  setInitialValues(initialValues: Partial<TValues>): void

  /**
   * 获取值的子集。
   *
   * @param names - 字段路径列表
   * @returns 值的子集
   */
  pickValues<TNames extends readonly (keyof TValues)[]>(
    names: TNames
  ): Pick<TValues, TNames[number]>
}
