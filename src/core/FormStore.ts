/**
 * FormStore - 表单数据存储
 *
 * 基于 Vue reactive 的响应式数据存储模块。
 * 职责：管理表单字段值（values）和初始值（initialValues）。
 *
 * @module core/FormStore
 *
 * @example
 * ```typescript
 * import { createFormStore } from './FormStore'
 *
 * // 创建 store
 * const store = createFormStore({
 *   initialValues: { name: 'John', age: 25 }
 * })
 *
 * // 获取/设置值
 * store.getFieldValue('name') // => 'John'
 * store.setFieldValue('name', 'Jane')
 *
 * // 批量操作
 * store.setFieldsValue({ name: 'Bob', age: 30 })
 * store.getFieldsValue(['name', 'age']) // => { name: 'Bob', age: 30 }
 *
 * // 检查字段是否被修改
 * store.isFieldTouched('name') // => true
 *
 * // 重置
 * store.reset()
 * store.resetField('name')
 * ```
 */

import { reactive } from "vue"

import { cloneDeep, isEqual } from "lodash-es"

import { getByPath, setByPath } from "./utils/path"

import type { FormValues } from "../types"

/**
 * FormStore 状态接口
 *
 * @template T - 表单值类型
 */
export interface FormStoreState<T extends FormValues> {
  /** 当前表单值 */
  values: T
  /** 初始值 */
  initialValues: T
}

/**
 * FormStore 配置选项
 *
 * @template T - 表单值类型
 */
export interface FormStoreOptions<T extends FormValues> {
  /** 初始值 */
  initialValues?: T
}

/**
 * FormStore 类 - 表单数据存储
 *
 * 使用 Vue reactive 实现响应式状态，所有通过 getFieldValue / getFieldsValue
 * 读取的值都会自动建立响应式依赖，在 computed / watch / render 中使用时
 * 能自动追踪变化并触发更新。
 *
 * @template T - 表单值类型，默认为 Record<string, any>
 */
export class FormStore<T extends FormValues> {
  /** 响应式状态 */
  public state: FormStoreState<T>

  constructor(options: FormStoreOptions<T> = {}) {
    const initialValues = (options.initialValues ?? {}) as T

    // 使用 Vue reactive 让 state 成为响应式对象
    this.state = reactive({
      values: cloneDeep(initialValues),
      initialValues: cloneDeep(initialValues),
    }) as FormStoreState<T>
  }

  // ==================== 值操作 ====================

  /**
   * 获取指定路径的字段值（响应式）
   */
  getFieldValue(path: string): any {
    return getByPath(this.state.values, path)
  }

  /**
   * 设置指定路径的字段值
   */
  setFieldValue(path: string, value: any): void {
    setByPath(this.state.values, path, value)
  }

  /**
   * 获取多个字段的值（响应式）
   *
   * 注意：不再 cloneDeep，直接返回响应式对象的引用，
   * 这样 Vue 的 computed/watch 能自动追踪变化。
   */
  getFieldsValue(): T
  getFieldsValue<K extends keyof T>(paths: K[]): Pick<T, K>
  getFieldsValue(paths?: string[]): Record<string, any>
  getFieldsValue(paths?: string[]): Record<string, any> {
    if (!paths) {
      return this.state.values
    }

    const result: Record<string, any> = {}
    for (const path of paths) {
      result[path] = this.getFieldValue(path)
    }

    return result
  }

  /**
   * 批量设置多个字段的值
   */
  setFieldsValue(values: Partial<T>): void {
    for (const [path, value] of Object.entries(values)) {
      setByPath(this.state.values, path, value)
    }
  }

  /**
   * 获取指定路径的初始值
   */
  getInitialValue(path: string): any {
    return getByPath(this.state.initialValues, path)
  }

  // ==================== Touched 状态 ====================

  /**
   * 检查指定字段是否被修改过
   */
  isFieldTouched(path: string): boolean {
    const currentValue = this.getFieldValue(path)
    const initialValue = getByPath(this.state.initialValues, path)

    return !isEqual(currentValue, initialValue)
  }

  /**
   * 检查多个字段是否被修改
   */
  isFieldsTouched(paths?: string[]): boolean {
    if (paths?.length) {
      return paths.every((path) => this.isFieldTouched(path))
    }

    return this.getTouchedFields().length > 0
  }

  /**
   * 获取所有被修改的字段路径
   */
  getTouchedFields(): string[] {
    const touchedFields: string[] = []
    const collectPaths = (obj: any, prefix = ""): void => {
      if (obj === null || typeof obj !== "object") return
      for (const key of Object.keys(obj)) {
        const path = prefix ? `${prefix}.${key}` : key
        const value = obj[key]
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
          collectPaths(value, path)
        } else if (this.isFieldTouched(path)) {
          touchedFields.push(path)
        }
      }
    }

    collectPaths(this.state.values)
    collectPaths(this.state.initialValues)

    return [...new Set(touchedFields)]
  }

  // ==================== 重置操作 ====================

  /**
   * 重置表单到初始状态
   */
  reset(values?: Partial<T>): void {
    const resetValues = values ?? this.state.initialValues

    // 清空当前 values 并重新赋值，保持 reactive 引用
    const keys = Object.keys(this.state.values)
    for (const key of keys) {
      delete (this.state.values as any)[key]
    }

    Object.assign(this.state.values, cloneDeep(resetValues))

    if (values) {
      const initKeys = Object.keys(this.state.initialValues)
      for (const key of initKeys) {
        delete (this.state.initialValues as any)[key]
      }

      Object.assign(this.state.initialValues, cloneDeep(values))
    }
  }

  /**
   * 重置指定字段到初始值
   */
  resetField(path: string): void {
    const initialValue = getByPath(this.state.initialValues, path)
    setByPath(this.state.values, path, cloneDeep(initialValue))
  }

  // ==================== 状态快照 ====================

  /**
   * 获取当前状态的只读快照（深拷贝，非响应式）
   */
  getState(): Readonly<FormStoreState<T>> {
    return {
      values: cloneDeep(this.state.values),
      initialValues: cloneDeep(this.state.initialValues),
    }
  }
}

/**
 * 创建 FormStore 实例的工厂函数
 */
export function createFormStore<T extends FormValues>(
  options: FormStoreOptions<T> = {}
): FormStore<T> {
  return new FormStore<T>(options)
}

export default FormStore
