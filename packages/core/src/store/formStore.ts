/**
 * FormStore - 基于 SignalMap 的纯 Signal 表单数据存储中心
 *
 * 使用 SignalMap 封装 @preact/signals-core 的响应式状态管理，
 * 每个字段路径对应一个独立的 Signal，支持自动依赖追踪和精确更新。
 * 所有状态变更通过 Signal effect 自动感知，无需手动订阅。
 *
 * @module core/store
 *
 * @example
 * ```typescript
 * const store = new FormStore({ initialValues: { name: 'John', age: 25 } })
 *
 * // 读写值
 * store.getFieldValue('name') // => 'John'
 * store.setFieldValue('name', 'Jane')
 *
 * // 批量操作
 * store.setFieldsValue({ name: 'Bob', age: 30 })
 * ```
 */

import { cloneDeep, isEqual } from "es-toolkit"

import { SignalMap } from "../signal"
import { collectObjectPathsByLeaf, getByPath, setByPath } from "../utils"

import type { NamePath, Value, Values } from "../types"

/**
 * FormStore 配置选项。
 *
 * @typeParam T - 表单值类型
 */
export interface FormStoreOptions<T extends Values> {
  /** 初始值 */
  initialValues?: T
}

/**
 * FormStore 状态接口（兼容旧代码引用）。
 *
 * @typeParam T - 表单值类型
 */
export interface FormStoreState<T extends Values> {
  /** 当前表单值 */
  values: T
  /** 初始值 */
  initialValues: T
}

/**
 * Pending 字段类型
 *
 * 正在操作中的字段信息
 */
export interface FormStorePendingField {
  field: string
  message: string
}

/**
 * 基于 SignalMap 的纯 Signal 表单数据存储中心。
 *
 * 每个字段路径对应一个独立的 Signal，通过 SignalMap 封装 @preact/signals-core 实现
 * 自动依赖追踪。所有状态变更通过 Signal effect 自动感知，无需手动订阅。
 *
 * @typeParam T - 表单值类型，默认为 Values
 *
 * @example
 * ```typescript
 * const store = new FormStore({ initialValues: { name: 'John' } })
 * store.getFieldValue('name') // => 'John'
 * ```
 */
export class FormStore<T extends Values> {
  /** SignalMap 存储：每个字段路径对应一个 Signal，由 SignalMap 统一管理 */
  private signalMap = new SignalMap<NamePath<T>, any>()

  /** 字段操作中状态映射：字段路径 -> 操作描述信息 */
  private pendingMap = new SignalMap<NamePath<T>, string | undefined>()

  /** 初始值 */
  private initialValues: T

  /**
   * 创建 FormStore 实例。
   *
   * 对 initialValues 进行深拷贝，确保内部状态与外部引用隔离。
   * 为每个初始字段路径创建对应的 Signal。
   *
   * @param options - 配置选项
   */
  constructor(options: FormStoreOptions<T> = {}) {
    const initialValues = (options.initialValues ?? {}) as T
    this.initialValues = cloneDeep(initialValues)

    // 为初始值的每个叶子路径创建 Signal
    const paths = collectObjectPathsByLeaf(initialValues)
    for (const path of paths) {
      const value = getByPath(initialValues, path)
      this.signalMap.set(path as NamePath<T>, cloneDeep(value))
    }
  }

  /**
   * 获取指定路径的字段值。
   *
   * 读取对应 Signal 的值，在 signal effect 中使用时自动收集依赖。
   *
   * @param path - 字段路径，支持嵌套路径如 'user.name'
   * @returns 字段当前值
   *
   * @example
   * ```typescript
   * store.getFieldValue('name')         // => 'John'
   * store.getFieldValue('user.address') // => { city: 'Beijing', zip: '100000' }
   * ```
   */
  getFieldValue(path: NamePath<T>): Value {
    return this.signalMap.get(path)
  }

  /**
   * 设置指定路径的字段值。
   *
   * 直接写入对应 Signal，自动触发依赖该 Signal 的 effect。
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
    this.signalMap.set(path, value)
  }

  /**
   * 获取多个字段的值。
   *
   * 不传参返回全量值，传入路径数组返回指定字段的值。
   * 读取 Signal 值时会收集依赖。
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
  getFieldsValue(): T
  getFieldsValue(paths: NamePath<T>[]): Partial<T>
  getFieldsValue(paths?: NamePath<T>[]): any {
    if (!paths) {
      const result = {} as T
      for (const key of this.signalMap.keys()) {
        setByPath(result, key, this.signalMap.get(key))
      }

      return result
    }

    const result: Partial<T> = {}
    for (const path of paths) {
      ;(result as any)[path] = this.getFieldValue(path as NamePath<T>)
    }

    return result
  }

  /**
   * 批量设置多个字段的值。
   *
   * 使用 SignalMap.batch 包裹，确保多次 Signal 写入只触发一次 effect 执行。
   *
   * @param values - 要设置的字段值对象
   *
   * @example
   * ```typescript
   * store.setFieldsValue({ name: 'Bob', age: 30 })
   * ```
   */
  setFieldsValue(values: Partial<T>): void {
    const paths = collectObjectPathsByLeaf(values)
    this.signalMap.batch(() => {
      for (const path of paths) {
        this.signalMap.set(path as NamePath<T>, getByPath(values, path))
      }
    })
  }

  /**
   * 获取单个字段值的快照。
   *
   * 使用 SignalMap.peek() 避免收集依赖，返回深拷贝的值。
   *
   * @param path - 字段路径
   *
   * @returns 该字段当前值的深拷贝
   *
   * @example
   * ```typescript
   * const name = store.getFieldSnapshot('name') // => 'John'（深拷贝）
   * ```
   */
  getFieldSnapshot(path: NamePath<T>): Value {
    return cloneDeep(this.signalMap.peek(path))
  }

  /**
   * 获取当前表单值的快照。
   *
   * 使用 SignalMap.peek() 避免收集依赖，返回深拷贝的普通对象。
   * 传入 paths 时只返回指定字段的快照。
   *
   * @param paths - 可选的字段路径数组，不传则返回全部字段
   *
   * @returns 当前表单值的原始对象（深拷贝）
   *
   * @example
   * ```typescript
   * const snapshot = store.getFieldsSnapshot()
   * const partial = store.getFieldsSnapshot(['name', 'age'])
   * ```
   */
  getFieldsSnapshot(): T
  getFieldsSnapshot(paths: NamePath<T>[]): Partial<T>
  getFieldsSnapshot(paths?: NamePath<T>[]): T | Partial<T> {
    const keys = paths ?? this.signalMap.keys()
    const result = {} as T

    for (const key of keys) {
      setByPath(result, key as string, cloneDeep(this.signalMap.peek(key)))
    }

    return result
  }

  /**
   * 获取指定字段的初始值。
   *
   * @param path - 字段路径
   * @returns 字段初始值，不存在时返回 undefined
   *
   * @example
   * ```typescript
   * store.getInitialValue('name') // => 'John'
   * ```
   */
  getInitialValue(path: NamePath<T>): Value {
    return getByPath(this.initialValues, path)
  }

  /**
   * 获取表单初始值。
   *
   * 不传参返回全量初始值的深拷贝，传入路径数组返回指定字段的初始值。
   *
   * @param paths - 可选，字段路径数组
   * @returns 全量初始值或指定字段的初始值
   *
   * @example
   * ```typescript
   * store.getInitialValues()         // => { name: 'John', age: 25 }
   * store.getInitialValues(['name']) // => { name: 'John' }
   * ```
   */
  getInitialValues(): T
  getInitialValues(paths: NamePath<T>[]): Partial<T>
  getInitialValues(paths?: NamePath<T>[]): T | Partial<T> {
    if (paths === undefined) {
      return cloneDeep(this.initialValues) as T
    }

    const result = {} as Partial<T>
    for (const path of paths) {
      setByPath(result, path, getByPath(this.initialValues, path))
    }

    return result
  }

  /**
   * 设置指定字段的初始值。
   *
   * @param path - 字段路径
   * @param value - 要设置的初始值
   *
   * @example
   * ```typescript
   * store.setInitialValue('name', 'Bob')
   * ```
   */
  setInitialValue(path: NamePath<T>, value: Value): void {
    setByPath(this.initialValues, path, value)
  }

  /**
   * 批量设置多个字段的初始值。
   *
   * @param values - 要设置的字段值对象
   *
   * @example
   * ```typescript
   * store.setInitialValues({ name: 'Bob', age: 30 })
   * ```
   */
  setInitialValues(values: Partial<T>): void {
    const paths = collectObjectPathsByLeaf(values)
    if (!paths.length) return

    for (const path of paths) {
      setByPath(this.initialValues, path, getByPath(values, path))
    }
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
    const currentValue = this.signalMap.peek(path)
    const initialValue = getByPath(this.initialValues, path)

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
  isFieldsTouched(paths?: NamePath<T>[]): boolean {
    if (Array.isArray(paths) && paths?.length) {
      return paths.every((path) => this.isFieldTouched(path as NamePath<T>))
    }

    return this.getTouchedFields().length > 0
  }

  /**
   * 获取所有被修改的字段路径。
   *
   * 遍历所有 Signal，与初始值比较，收集不同的路径。
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
    for (const key of this.signalMap.keys()) {
      if (this.isFieldTouched(key as NamePath<T>)) {
        touchedFields.push(key)
      }
    }

    return touchedFields
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
    const initialValue = getByPath(this.initialValues, path)
    this.setFieldValue(path, cloneDeep(initialValue))
  }

  /**
   * 重置表单到初始状态（diff 式更新）。
   *
   * 不传参时恢复到构造时的初始值，传入 values 时同时更新初始值。
   * 使用 SignalMap.batch 包裹，在 batch 内对比新旧路径集合：
   * 复用已有 key（set 更新 Signal.value）、删除多余 key、创建新 key。
   * 不调用 signalMap.clear()，确保 effect 依赖追踪不断裂。
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
    const resetValues = values ?? this.initialValues

    if (values) {
      this.initialValues = cloneDeep(values) as T
    }

    this.signalMap.batch(() => {
      const newPaths = new Set(collectObjectPathsByLeaf(resetValues).map(String))

      // 1. 删除不在目标值中的 key
      for (const key of [...this.signalMap.keys()]) {
        if (!newPaths.has(key)) {
          this.signalMap.delete(key)
        } else {
          this.signalMap.set(key, cloneDeep(getByPath(resetValues, key)))
        }
      }
    })
  }

  /**
   * 设置字段的操作中状态。
   *
   * 标记字段正在进行异步操作（如文件上传），
   * 校验和提交时会检查是否有字段处于操作中状态。
   * 取消操作中状态时删除对应 key，保持 map 干净。
   *
   * @param path - 字段路径
   * @param pending - 是否处于操作中
   *
   * @example
   * ```typescript
   * store.setFieldPending('avatar', true)   // 上传开始
   * store.setFieldPending('avatar', false)  // 上传结束
   * ```
   */
  setFieldPending(path: NamePath<T>, pending: boolean, message?: string): void {
    if (pending) {
      this.pendingMap.set(path, message)
    } else {
      this.pendingMap.delete(path)
    }
  }

  /**
   * 检查单个字段是否处于操作中。
   *
   * 读取对应 Signal 的值，在 effect 中使用时自动收集依赖。
   *
   * @param path - 字段路径
   * @returns 是否处于操作中
   *
   * @example
   * ```typescript
   * store.isFieldPending('avatar') // => true
   * ```
   */
  isFieldPending(path: NamePath<T>): boolean {
    return this.pendingMap.has(path) ?? false
  }

  /**
   * 获取所有处于操作中的字段路径。
   *
   * 遍历 pendingMap，收集值为 true 的字段路径。
   * 无操作中字段时返回空数组。
   *
   * @returns 操作中的字段路径数组
   *
   * @example
   * ```typescript
   * store.getPendingFields() // => ['avatar', 'attachment']
   * ```
   */
  getPendingFields(): FormStorePendingField[] {
    const fields: FormStorePendingField[] = []

    for (const field of this.pendingMap.keys()) {
      fields.push({ field, message: this.pendingMap.peek(field) ?? "" })
    }

    return fields
  }

  /**
   * 销毁 Store 实例。
   *
   * 通过 SignalMap.destroy() 清理所有内部 effect 和 signal，释放资源。
   *
   * @example
   * ```typescript
   * store.destroy()
   * ```
   */
  destroy(): void {
    this.signalMap.destroy()
    this.pendingMap.destroy()
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
export function createFormStore<T extends Values>(
  options: FormStoreOptions<T> = {}
): FormStore<T> {
  return new FormStore<T>(options)
}

export default FormStore
