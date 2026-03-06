/**
 * FormStore - 表单数据存储
 *
 * 基于 Vue reactive 的响应式数据存储模块。
 * 职责：管理表单字段值（values）和初始值（initialValues）。
 *
 * @module core/store
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

import { reactive, readonly, toRaw } from "vue"
import type { DeepReadonly } from "vue"

import { cloneDeep, isEqual } from "es-toolkit"

import { getByPath, setByPath } from "../utils/path"

import type { FormValues, NamePath, Value } from "../types"

/**
 * FormStore 状态接口。
 *
 * @typeParam T - 表单值类型
 */
export interface FormStoreState<T extends FormValues> {
  /** 当前表单值 */
  values: T
  /** 初始值 */
  initialValues: T
}

/**
 * FormStore 配置选项。
 *
 * @typeParam T - 表单值类型
 */
export interface FormStoreOptions<T extends FormValues> {
  /** 初始值 */
  initialValues?: T
}

/**
 * 表单数据存储。
 *
 * 使用 Vue reactive 实现响应式状态，所有通过 getFieldValue / getFieldsValue
 * 读取的值都会自动建立响应式依赖，在 computed / watch / render 中使用时
 * 能自动追踪变化并触发更新。
 *
 * @typeParam T - 表单值类型，默认为 FormValues
 *
 * @example
 * ```typescript
 * const store = new FormStore({ initialValues: { name: 'John' } })
 * store.getFieldValue('name') // => 'John'
 * ```
 *
 * @remarks
 * 内部状态通过 Vue reactive 包装，类型层面不暴露 Reactive 以避免 UnwrapRef 问题。
 */
export class FormStore<T extends FormValues> {
  /** 响应式状态（运行时为 reactive，类型层面不暴露 Reactive 以避免 UnwrapRef 问题） */
  private state: FormStoreState<T>

  /**
   * 创建 FormStore 实例。
   *
   * 对 initialValues 进行深拷贝，确保内部状态与外部引用隔离。
   *
   * @param options - 配置选项
   */
  constructor(options: FormStoreOptions<T> = {}) {
    const initialValues = (options.initialValues ?? {}) as T

    // 使用 Vue reactive 让 state 成为响应式对象
    this.state = reactive({
      values: cloneDeep(initialValues),
      initialValues: cloneDeep(initialValues),
    }) as FormStoreState<T>
  }

  /**
   * 获取指定路径的字段值。
   *
   * 返回响应式引用，在 computed/watch 中使用时自动追踪变化。
   *
   * @param path - 字段路径，支持嵌套路径如 'user.name'
   * @returns 字段当前值
   *
   * @example
   * ```typescript
   * store.getFieldValue('name')         // => 'John'
   * store.getFieldValue('user.address') // => { city: 'Beijing' }
   * ```
   */
  getFieldValue(path: NamePath<T>): DeepReadonly<Value> {
    const raw = getByPath(this.state.values, path)

    // 原始类型无法被 readonly() 包装，直接返回
    return raw !== null && typeof raw === "object" ? readonly(raw) : raw
  }

  /**
   * 设置指定路径的字段值。
   *
   * @param path - 字段路径
   * @param value - 要设置的值
   *
   * @example
   * ```typescript
   * store.setFieldValue('name', 'Jane')
   * store.setFieldValue('user.age', 30)
   * ```
   */
  setFieldValue(path: NamePath<T>, value: Value): void {
    setByPath(this.state.values, path, value)
  }

  /**
   * 获取多个字段的值。
   *
   * 不传参返回全量值，传入路径数组返回指定字段的值。
   * 直接返回响应式引用，Vue 的 computed/watch 能自动追踪变化。
   *
   * @param paths - 可选，要获取的字段路径数组
   * @returns 全量值或指定字段的值
   *
   * @example
   * ```typescript
   * store.getFieldsValue()                  // => { name: 'John', age: 25 }
   * store.getFieldsValue(['name', 'age'])   // => { name: 'John', age: 25 }
   * ```
   */
  getFieldsValue(): DeepReadonly<T>
  getFieldsValue(paths: NamePath<T>[]): DeepReadonly<Partial<T>>
  getFieldsValue(paths?: NamePath<T>[]): any {
    if (!paths) {
      return readonly(this.state.values)
    }

    const result: Partial<T> = {}

    for (const path of paths) {
      ;(result as any)[path] = this.getFieldValue(path as NamePath<T>)
    }

    return readonly(result)
  }

  /**
   * 批量设置多个字段的值。
   *
   * @param values - 要设置的字段值对象
   *
   * @example
   * ```typescript
   * store.setFieldsValue({ name: 'Bob', age: 30 })
   * ```
   */
  setFieldsValue(values: DeepReadonly<Partial<T>>): void {
    for (const [path, value] of Object.entries(values)) {
      setByPath(this.state.values, path, value)
    }
  }

  /**
   * 获取当前表单值的快照。
   *
   * 用于序列化、提交等场景，返回解除 reactive 代理后的原始对象。
   *
   * @returns 当前表单值的原始对象（解除 reactive 代理）
   *
   * @example
   * ```typescript
   * const snapshot = store.getFieldsSnapshot()
   * JSON.stringify(snapshot)
   * ```
   */
  getFieldsSnapshot(): T {
    return toRaw(this.state.values) as T
  }

  /**
   * 获取指定路径的初始值。
   *
   * @param path - 字段路径
   * @returns 字段的初始值
   *
   * @example
   * ```typescript
   * store.getInitialValue('name') // => 'John'
   * ```
   */
  getInitialValue(path: NamePath<T>): Value {
    return getByPath(this.state.initialValues, path)
  }

  /**
   * 检查指定字段是否被修改过。
   *
   * 通过深比较当前值与初始值判断。
   *
   * @param path - 字段路径
   * @returns 是否与初始值不同
   *
   * @example
   * ```typescript
   * store.setFieldValue('name', 'Jane')
   * store.isFieldTouched('name') // => true
   * ```
   */
  isFieldTouched(path: NamePath<T>): boolean {
    const currentValue = this.getFieldValue(path)
    const initialValue = getByPath(this.state.initialValues, path)

    return !isEqual(currentValue, initialValue)
  }

  /**
   * 检查多个字段是否被修改。
   *
   * 传入路径数组时检查所有指定字段是否都被修改，不传则检查是否有任一字段被修改。
   *
   * @param paths - 可选，要检查的字段路径数组
   * @returns 是否被修改
   *
   * @example
   * ```typescript
   * store.isFieldsTouched(['name', 'age']) // => true（全部被修改时）
   * store.isFieldsTouched()               // => true（任一字段被修改时）
   * ```
   */
  isFieldsTouched(paths?: NamePath<T>): boolean {
    if (Array.isArray(paths) && paths?.length) {
      return paths.every((path) => this.isFieldTouched(path as NamePath<T>))
    }

    return this.getTouchedFields().length > 0
  }

  /**
   * 获取所有被修改的字段路径。
   *
   * 递归遍历当前值和初始值，收集所有与初始值不同的叶子路径。
   *
   * @returns 被修改的字段路径数组
   *
   * @example
   * ```typescript
   * store.getTouchedFields() // => ['name', 'user.age']
   * ```
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
        } else if (this.isFieldTouched(path as NamePath<T>)) {
          touchedFields.push(path)
        }
      }
    }

    collectPaths(this.state.values)
    collectPaths(this.state.initialValues)

    return [...new Set(touchedFields)]
  }

  /**
   * 重置表单到初始状态。
   *
   * 不传参时恢复到构造时的初始值，传入 values 时同时更新初始值。
   * 通过清空再赋值的方式保持 reactive 引用不变。
   *
   * @param values - 可选，新的初始值
   *
   * @example
   * ```typescript
   * store.reset()                              // 恢复到构造时的初始值
   * store.reset({ name: 'New', age: 0 })       // 重置并更新初始值
   * ```
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
   * 重置指定字段到初始值。
   *
   * @param path - 要重置的字段路径
   *
   * @example
   * ```typescript
   * store.resetField('name')
   * ```
   */
  resetField(path: NamePath<T>): void {
    const initialValue = getByPath(this.state.initialValues, path)
    setByPath(this.state.values, path, cloneDeep(initialValue))
  }
}

/**
 * 创建 FormStore 实例的工厂函数。
 *
 * @typeParam T - 表单值类型
 *
 * @param options - 配置选项
 * @returns FormStore 实例
 *
 * @example
 * ```typescript
 * const store = createFormStore({ initialValues: { name: 'John' } })
 * ```
 */
export function createFormStore<T extends FormValues>(
  options: FormStoreOptions<T> = {}
): FormStore<T> {
  return new FormStore<T>(options)
}

export default FormStore
