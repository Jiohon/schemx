/**
 * Value Graph - 字段值事实存储（骨架）
 *
 * @module core/valueGraph/valueGraph
 */

import type { ValueGraph, ValueGraphSnapshot, FieldValueNode } from "./types"
import type { NodeId } from "../schemaGraph/types"
import type { Values } from "../types/form"
import { signal } from "@preact/signals-core"

/**
 * Field Value Node 实现。
 */
class FieldValueNodeImpl<
  TValues extends Values = Values,
  TName extends keyof TValues = keyof TValues,
> implements FieldValueNode<TValues, TName> {
  readonly name: TName
  readonly value = signal<TValues[TName] | undefined>(undefined)
  readonly initialValue = signal<TValues[TName] | undefined>(undefined)
  readonly touched = signal(false)
  readonly dirty = signal(false)
  readonly errors = signal<readonly string[]>([])
  readonly validating = signal(false)

  constructor(name: TName, initialValue?: TValues[TName]) {
    this.name = name
    this.initialValue.value = initialValue
    this.value.value = initialValue
  }

  updateDirty(): void {
    this.dirty.value = this.value.value !== this.initialValue.value
  }
}

/**
 * Value Graph 实现（骨架）。
 */
export class ValueGraphImpl<TValues extends Values = Values> implements ValueGraph<TValues> {
  private fieldsByNodeId: Map<NodeId, FieldValueNodeImpl<TValues>> = new Map()
  private fieldsByName: Map<keyof TValues, FieldValueNodeImpl<TValues>> = new Map()
  private _initialValues: Partial<TValues> = {}

  get snapshot(): ValueGraphSnapshot<TValues> {
    const values: Partial<TValues> = {}
    const touched: Partial<Record<keyof TValues, boolean>> = {}
    const dirty: Partial<Record<keyof TValues, boolean>> = {}
    const errors: Partial<Record<keyof TValues, readonly string[]>> = {}
    const validating: Partial<Record<keyof TValues, boolean>> = {}

    for (const field of this.fieldsByName.values()) {
      values[field.name] = field.value.value
      touched[field.name] = field.touched.value
      dirty[field.name] = field.dirty.value
      errors[field.name] = field.errors.value
      validating[field.name] = field.validating.value
    }

    return {
      values: values as TValues,
      touched,
      dirty,
      errors,
      validating,
    }
  }

  mountField<TName extends keyof TValues>(
    nodeId: NodeId,
    name: TName,
    initialValue?: TValues[TName]
  ): FieldValueNode<TValues, TName> {
    let field = this.fieldsByNodeId.get(nodeId) as FieldValueNodeImpl<TValues, TName> | undefined

    if (!field) {
      // 检查是否已存在同名字段（来自不同节点）
      const existingByName = this.fieldsByName.get(name)
      if (existingByName) {
        // 复用现有字段
        field = existingByName as unknown as FieldValueNodeImpl<TValues, TName>
      } else {
        // 创建新字段
        const finalInitialValue =
          initialValue !== undefined ? initialValue : this._initialValues[name]
        field = new FieldValueNodeImpl<TValues, TName>(name, finalInitialValue as TValues[TName])
        this.fieldsByName.set(name, field as unknown as FieldValueNodeImpl<TValues>)
      }
      this.fieldsByNodeId.set(nodeId, field as unknown as FieldValueNodeImpl<TValues>)
    }

    return field as FieldValueNode<TValues, TName>
  }

  getField(nodeId: NodeId): FieldValueNode<TValues> | undefined {
    return this.fieldsByNodeId.get(nodeId) as FieldValueNode<TValues> | undefined
  }

  getFieldByName<TName extends keyof TValues>(
    name: TName
  ): FieldValueNode<TValues, TName> | undefined {
    return this.fieldsByName.get(name) as unknown as FieldValueNodeImpl<TValues, TName> | undefined
  }

  setValue<TName extends keyof TValues>(name: TName, value: TValues[TName] | undefined): void {
    const field = this.fieldsByName.get(name)
    if (field) {
      field.value.value = value
      field.updateDirty()
    } else {
      // 字段未 mount，先创建
      const nodeId = `temp_${String(name)}`
      this.mountField(nodeId, name, value)
    }
  }

  getValue<TName extends keyof TValues>(name: TName): TValues[TName] | undefined {
    const field = this.fieldsByName.get(name)
    if (field) {
      return field.value.value
    }
    // 字段尚未 mount，回退到初始值
    return this._initialValues[name]
  }

  setErrors<TName extends keyof TValues>(name: TName, errors: readonly string[]): void {
    const field = this.fieldsByName.get(name)
    if (field) {
      field.errors.value = errors
    }
  }

  setValidating<TName extends keyof TValues>(name: TName, validating: boolean): void {
    const field = this.fieldsByName.get(name)
    if (field) {
      field.validating.value = validating
    }
  }

  setTouched<TName extends keyof TValues>(name: TName, touched: boolean): void {
    const field = this.fieldsByName.get(name)
    if (field) {
      field.touched.value = touched
    }
  }

  disposeNode(nodeId: NodeId): void {
    this.fieldsByNodeId.delete(nodeId)
    // 注意：不删除 fieldsByName 中的条目，因为可能被其他节点复用
  }

  setInitialValues(initialValues: Partial<TValues>): void {
    this._initialValues = { ...initialValues }
    // 更新现有字段的 initialValue
    for (const [name, value] of Object.entries(initialValues) as [
      keyof TValues,
      TValues[keyof TValues],
    ][]) {
      const field = this.fieldsByName.get(name)
      if (field) {
        field.initialValue.value = value
        field.updateDirty()
      }
    }
  }

  pickValues<TNames extends readonly (keyof TValues)[]>(
    names: TNames
  ): Pick<TValues, TNames[number]> {
    const result: Partial<Pick<TValues, TNames[number]>> = {}
    for (const name of names) {
      const field = this.fieldsByName.get(name)
      if (field) {
        result[name] = field.value.value
      }
    }
    return result as Pick<TValues, TNames[number]>
  }
}

/**
 * 创建 ValueGraph 实例。
 */
export function createValueGraph<TValues extends Values = Values>(): ValueGraph<TValues> {
  return new ValueGraphImpl<TValues>()
}
