/**
 * FormInstance - 表单实例核心类
 *
 * 组合 Store、Validator、Subscriber，提供统一的表单操作接口。
 * 实现 FormInstance 接口，作为 useForm 的底层实现。
 *
 * @module hooks/useForm
 *
 * @example
 * ```typescript
 * import { useForm } from './useForm'
 *
 * // 在 Vue 组件中使用
 * const form = useForm({
 *   columns: [...],
 *   initialValues: { name: '', age: 0 },
 *   onFinish: (values) => console.log(values),
 * })
 *
 * // 或直接创建实例（非组件场景）
 * const instance = createFormInstance({ initialValues: { name: '' } })
 * ```
 */
import { onUnmounted, provide } from "vue"
import type { DeepReadonly } from "vue"

import { getInitialValuesFromColumns } from "@/utils"
import { withLock } from "@/utils/async"

import { createFormStore, FormStore } from "../../core/store"
import {
  createSubscriber,
  type FieldsSubscribeCallback,
  FieldSubscribeCallback,
  GlobalSubscribeCallback,
  Subscriber,
} from "../../core/subscriber"
import {
  createValidator,
  type ValidateError,
  type ValidateResult,
  Validator,
} from "../../core/validator"

import type { FormValues, NamePath, SchemaColumn, Value } from "../../types"
import { FormInstance } from "./types/instance"
import { ZodType } from "zod"

/**
 * 表单回调函数集合
 *
 * 从 FormInstanceOptions 中提取的回调函数子集，用于内部存储。
 *
 * @typeParam T - 表单值类型
 */
export type Callbacks<T extends FormValues> = Pick<
  FormInstanceOptions<T>,
  "onValuesChange" | "onFinish" | "onFinishFailed"
>

/**
 * FormInstance 配置选项
 *
 * @typeParam T - 表单值类型
 */
export interface FormInstanceOptions<T extends FormValues> {
  /** 表单列配置，用于提取初始值和校验规则 */
  columns?: SchemaColumn<T>[]
  /** 初始值，与 columns 中的 initialValue 合并 */
  initialValues?: T
  /** 双向绑定的表单值（v-model） */
  modelValue?: T

  /** 字段值更新时触发的回调 */
  onValuesChange?: (changedValues: Partial<T>, latestValues: T) => void
  /** 表单提交校验通过后的回调 */
  onFinish?: (values: DeepReadonly<T>) => void | Promise<void>
  /** 表单提交校验失败后的回调 */
  onFinishFailed?: (error: ValidateError<T>) => void
}

/** FormInstance 在 Vue provide/inject 中的注入 key */
export const FORM_INSTANCE_KEY = Symbol("FormInstance")

/**
 * 表单实例核心类
 *
 * 组合 FormStore（状态管理）、Validator（校验）、Subscriber（订阅）三个模块，
 * 对外提供统一的表单操作 API。实现 FormInstance 接口。
 *
 * @typeParam T - 表单值类型，默认为 FormValues
 *
 * @example
 * ```typescript
 * const form = new FormInstance({
 *   initialValues: { name: '', email: '' },
 *   onFinish: (values) => api.submit(values),
 * })
 *
 * form.setFieldValue('name', 'John')
 * await form.submit()
 * ```
 *
 * @remarks
 * 内部通过 Subscriber 实现发布-订阅模式，所有值变更都会通知相关订阅者。
 * 提交操作通过 withLock 防止重复提交。
 */
class CreateFormInstance<T extends FormValues = FormValues> implements FormInstance<T> {
  /** 表单状态存储，管理字段值和初始值 */
  private store: FormStore<T>

  /** 表单校验器，管理校验规则和错误信息 */
  private validator: Validator<T>

  /** 发布订阅管理器，管理字段级和全局订阅 */
  private subscriber: Subscriber<T>

  /** 回调函数集合（onValuesChange / onFinish / onFinishFailed） */
  private callbacks: Callbacks<T> = {}

  /** 表单是否正在提交中 */
  private _submitting: boolean = false

  /**
   * 创建 FormInstance 实例
   *
   * 初始化 Store、Subscriber、Validator 三个核心模块，
   * 从 columns 中提取初始值和校验规则，注册值变化回调。
   *
   * @param options - 表单配置选项
   *
   * @example
   * ```typescript
   * const form = new FormInstance({
   *   columns: [{ name: 'email', componentType: 'input', rules: z.string().email() }],
   *   initialValues: { email: '' },
   * })
   * ```
   */

  constructor(options: FormInstanceOptions<T> = {}) {
    const { columns, initialValues = {} as T } = options

    this.setCallbacks({
      onValuesChange: options.onValuesChange,
      onFinish: options.onFinish,
      onFinishFailed: options.onFinishFailed,
    })

    const mergedInitialValues = getInitialValuesFromColumns<T>(
      initialValues,
      columns ?? []
    )

    // Store: 初始化状态管理
    this.store = createFormStore<T>({ initialValues: mergedInitialValues as T })

    // Subscriber: 初始化订阅管理
    this.subscriber = createSubscriber<T>()

    // Validator: 初始化校验器
    this.validator = createValidator<T>()

    if (columns) {
      this.validator.registerRulesFromColumns(columns)
    }

    // 注册值变化回调
    if (this.callbacks?.onValuesChange) {
      this.subscriber.subscribeAll((payload, _prevSnapshot, latestSnapshot) => {
        this.callbacks.onValuesChange?.(
          payload.changedValues as Partial<T>,
          latestSnapshot as T
        )
      })
    }
  }

  /**
   * 设置回调函数
   *
   * @param callbacks - 回调函数集合
   */
  private setCallbacks = (callbacks: Callbacks<T>) => {
    this.callbacks = callbacks
  }

  /**
   * 设置单个字段值并通知订阅者
   *
   * 更新 store 中的值，然后通过 notify 通知所有相关订阅者。
   *
   * @param name - 字段路径
   * @param value - 字段值
   *
   * @example
   * ```typescript
   * form.setFieldValue('name', 'John')
   * form.setFieldValue('user.address.city', 'Beijing')
   * ```
   */
  public setFieldValue(name: NamePath<T>, value: Value): void {
    const prevSnapshot = this.store.getFieldsValue()
    const prevValue = this.store.getFieldValue(name)

    this.store.setFieldValue(name, value)

    const values = { name: value } as DeepReadonly<Partial<T>>
    const oldvalues = { name: prevValue } as DeepReadonly<Partial<T>>

    this.notify(values, oldvalues, prevSnapshot)
  }

  /**
   * 批量设置字段值并通知订阅者
   *
   * 一次性更新多个字段，只触发一次通知。
   *
   * @param values - 要设置的字段值对象
   *
   * @example
   * ```typescript
   * form.setFieldsValue({ name: 'John', age: 25 })
   * ```
   */
  public setFieldsValue(values: DeepReadonly<Partial<T>>): void {
    const prevSnapshot = this.store.getFieldsValue()
    this.store.setFieldsValue(values)
    this.notify(values, prevSnapshot, prevSnapshot)
  }

  /**
   * 获取单个字段的当前值
   *
   * 返回响应式引用，在 computed/watch 中使用时自动追踪变化。
   *
   * @param path - 字段路径
   * @returns 字段当前值（只读）
   *
   * @example
   * ```typescript
   * const name = form.getFieldValue('name')
   * ```
   */
  public getFieldValue(path: NamePath<T>): DeepReadonly<Value> {
    return this.store.getFieldValue(path)
  }

  /**
   * 获取多个字段的值
   *
   * 不传参返回全量只读值，传入路径数组返回指定字段的值。
   *
   * @param paths - 可选，要获取的字段路径数组
   * @returns 全量只读值或指定字段的值
   *
   * @example
   * ```typescript
   * const all = form.getFieldsValue()
   * const partial = form.getFieldsValue(['name', 'email'])
   * ```
   */
  public getFieldsValue(paths?: NamePath<T>[]): any {
    if (paths) {
      return this.store.getFieldsValue(paths)
    }

    return this.store.getFieldsValue()
  }

  /**
   * 获取当前表单值的快照
   *
   * 返回解除 reactive 代理后的原始对象，适用于序列化、提交等场景。
   *
   * @returns 当前表单值的原始对象
   *
   * @example
   * ```typescript
   * const snapshot = form.getFieldsSnapshot()
   * JSON.stringify(snapshot)
   * ```
   */
  public getFieldsSnapshot(): T {
    return this.store.getFieldsSnapshot()
  }

  /**
   * 获取字段的初始值
   *
   * @param path - 字段路径
   * @returns 字段初始值
   *
   * @example
   * ```typescript
   * const initialName = form.getInitialValue('name')
   * ```
   */
  public getInitialValue(path: NamePath<T>): Value {
    return this.store.getInitialValue(path)
  }

  /**
   * 注册字段校验规则
   *
   * @param path - 字段路径
   * @param rule - Zod schema 校验规则
   *
   * @example
   * ```typescript
   * import { z } from 'zod'
   * form.registerRule('email', z.string().email('邮箱格式错误'))
   * ```
   */
  public registerRule(path: NamePath<T>, rule: ZodType): void {
    this.validator.registerRule(path, rule)
  }

  /**
   * 注销字段校验规则
   *
   * 同时清除该字段的错误信息。
   *
   * @param path - 字段路径
   *
   * @example
   * ```typescript
   * form.unregisterRule('email')
   * ```
   */
  public unregisterRule(path: NamePath<T>): void {
    this.validator.unregisterRule(path)
  }

  /**
   * 校验指定字段
   *
   * 从 store 获取当前全量值传入 Validator 进行校验。
   *
   * @param name - 字段名或字段名数组
   * @returns 校验结果，成功返回 values，失败返回 errors
   *
   * @example
   * ```typescript
   * const result = await form.validateField('email')
   * const result = await form.validateField(['name', 'email'])
   * if (!result.ok) console.log(result.error.errors)
   * ```
   */
  public async validateField(name: string | string[]): Promise<ValidateResult<T>> {
    const result = await this.validator.validateField(
      name as NamePath<T> | NamePath<T>[],
      this.store.getFieldsValue()
    )

    return result
  }

  /**
   * 校验所有已注册字段
   *
   * 从 store 获取当前全量值传入 Validator 进行全量校验。
   * 校验期间自动设置 submitting 状态，完成后恢复。
   *
   * @returns 校验结果，成功返回 values，失败返回 errors
   *
   * @example
   * ```typescript
   * const result = await form.validate()
   * if (result.ok) submitToServer(result.values)
   * ```
   */
  public async validate(): Promise<ValidateResult<T>> {
    try {
      this.setSubmitting(true)

      const result = await this.validator.validate(this.store.getFieldsValue())

      return result
    } finally {
      this.setSubmitting(false)
    }
  }
  /**
   * 获取指定字段的错误信息
   *
   * @param path - 字段路径
   * @returns 错误信息数组，无错误时返回 undefined
   *
   * @example
   * ```typescript
   * const errors = form.getFieldError('email')
   * // => ['邮箱格式错误'] 或 undefined
   * ```
   */
  public getFieldError(path: NamePath<T>): string[] | undefined {
    return this.validator.getFieldError(path)
  }

  /**
   * 手动设置字段的错误信息
   *
   * @param path - 字段路径
   * @param errors - 错误信息数组
   *
   * @example
   * ```typescript
   * form.setFieldError('username', ['用户名已存在'])
   * ```
   */
  public setFieldError(path: NamePath<T>, errors: string[]): void {
    this.validator.setFieldError(path, errors)
  }

  /**
   * 提交表单
   *
   * 通过 withLock 防止重复提交，提交进行中时返回同一个 Promise。
   * 校验通过调用 onFinish，失败调用 onFinishFailed。
   *
   * @example
   * ```typescript
   * await form.submit()
   * ```
   */
  public submit = withLock(async (): Promise<void> => {
    const result = await this.validate()
    if (result.ok) {
      await this.callbacks.onFinish?.(result.values)
    } else {
      this.callbacks.onFinishFailed?.(result.error)
    }
  })

  /**
   * 重置整个表单到初始值并通知订阅者
   *
   * @example
   * ```typescript
   * form.reset()
   * ```
   */
  public reset(): void {
    const prevSnapshot = this.store.getFieldsValue()
    this.store.reset()
    const latestValues = this.store.getFieldsValue()
    this.notify(latestValues, prevSnapshot, prevSnapshot)
  }

  /**
   * 重置指定字段到初始值并通知订阅者
   *
   * @param names - 要重置的字段路径数组
   *
   * @example
   * ```typescript
   * form.resetFields(['name', 'email'])
   * ```
   */
  public resetFields(names: NamePath<T>[]): void {
    const prevSnapshot = this.store.getFieldsValue()

    names.forEach((name) => {
      this.store.resetField(name)
    })
    const newValues = this.store.getFieldsValue(names)

    this.notify(newValues, prevSnapshot, prevSnapshot)
  }

  /**
   * 检查单个字段是否被修改
   *
   * 通过深比较当前值与初始值判断。
   *
   * @param path - 字段路径
   * @returns 是否与初始值不同
   *
   * @example
   * ```typescript
   * form.isFieldTouched('name') // => true
   * ```
   */
  public isFieldTouched(path: NamePath<T>): boolean {
    return this.store.isFieldTouched(path)
  }

  /**
   * 检查多个字段是否被修改
   *
   * 传入路径数组时检查所有指定字段是否都被修改，不传则检查是否有任一字段被修改。
   *
   * @param path - 可选，要检查的字段路径
   * @returns 是否被修改
   *
   * @example
   * ```typescript
   * form.isFieldsTouched(['name', 'email']) // 所有字段都被修改才返回 true
   * form.isFieldsTouched()                  // 任一字段被修改即返回 true
   * ```
   */
  public isFieldsTouched(path?: NamePath<T>): boolean {
    return this.store.isFieldsTouched(path)
  }

  /**
   * 获取所有被修改的字段路径
   *
   * @returns 被修改的字段路径数组
   *
   * @example
   * ```typescript
   * form.getTouchedFields() // => ['name', 'user.age']
   * ```
   */
  public getTouchedFields(): string[] {
    return this.store.getTouchedFields()
  }

  /**
   * 订阅单个字段变化
   *
   * 当订阅的字段发生变化时，回调会收到变更载荷和前后快照。
   *
   * @param path - 要订阅的字段路径
   * @param callback - 变化时的回调函数
   * @returns 取消订阅的函数
   *
   * @example
   * ```typescript
   * const unsubscribe = form.subscribe('name', (payload, prevSnapshot, latestSnapshot) => {
   *   console.log(`${payload.path} changed to ${payload.value}`)
   * })
   * unsubscribe()
   * ```
   */
  public subscribe(path: NamePath<T>, callback: FieldSubscribeCallback<T>): () => void {
    return this.subscriber.subscribe(path, callback)
  }

  /**
   * 订阅多个字段变化
   *
   * 委托给 Subscriber.subscribeFields，当任一指定字段变化时，
   * 以组为单位触发一次回调，传入所有订阅字段的值快照。
   *
   * @param paths - 要订阅的字段路径数组
   * @param callback - 变化时的回调函数
   * @returns 取消所有订阅的函数
   *
   * @example
   * ```typescript
   * const unsubscribe = form.subscribeFields(['name', 'email'], (payload) => {
   *   console.log('subscribed fields:', payload.changedValues)
   * })
   * unsubscribe()
   * ```
   */
  public subscribeFields(
    paths: NamePath<T>[],
    callback: FieldsSubscribeCallback<T>
  ): () => void {
    return this.subscriber.subscribeFields(paths, callback)
  }

  /**
   * 订阅所有字段变化
   *
   * 当任何字段值变化时都会收到通知，适用于表单级别的监听。
   *
   * @param callback - 变化时的回调函数
   * @returns 取消订阅的函数
   *
   * @example
   * ```typescript
   * const unsubscribe = form.subscribeAll((payload) => {
   *   console.log('Changed:', payload.changedValues)
   * })
   * unsubscribe()
   * ```
   */
  public subscribeAll(callback: GlobalSubscribeCallback<T>): () => void {
    return this.subscriber.subscribeAll(callback)
  }

  /**
   * 检查表单是否正在提交中
   *
   * @returns 是否正在提交
   */
  public isSubmitting(): boolean {
    return this._submitting
  }

  /**
   * 设置表单提交状态
   *
   * @param submitting - 是否正在提交
   */
  public setSubmitting(submitting: boolean): void {
    this._submitting = submitting
  }

  /**
   * 销毁表单实例
   *
   * 清除所有订阅回调，释放资源。通常在组件卸载时调用。
   */
  public destroy(): void {
    this.subscriber.clear()
  }

  /**
   * 统一的通知入口
   *
   * 将变更数据分发给 Subscriber，由其负责逐字段、多字段组、全局三级通知。
   *
   * @param newValues - 已变化的字段值对象（部分）
   * @param prevValues - 变化前的字段旧值（部分）
   * @param prevSnapshot - 变化前的全量值快照
   */
  private notify(
    newValues: DeepReadonly<Partial<T>>,
    prevValues: DeepReadonly<Partial<T>>,
    prevSnapshot: DeepReadonly<T>
  ): void {
    this.subscriber.notify(
      newValues,
      prevValues,
      prevSnapshot,
      this.store.getFieldsValue()
    )
  }
}

/**
 * 创建 FormInstance 实例的工厂函数
 *
 * @typeParam T - 表单值类型
 *
 * @param options - 表单配置选项
 * @returns FormInstance 实例
 *
 * @example
 * ```typescript
 * const form = createFormInstance({
 *   initialValues: { name: 'John' },
 *   onFinish: (values) => console.log(values),
 * })
 * ```
 */
export function createFormInstance<T extends FormValues>(
  options: FormInstanceOptions<T> = {}
): FormInstance<T> {
  return new CreateFormInstance<T>(options)
}

/**
 * 表单组合式函数
 *
 * 创建 FormInstance 并通过 Vue provide 注入到子组件树中，
 * 组件卸载时自动销毁实例。
 *
 * @typeParam T - 表单值类型
 *
 * @param options - 表单配置选项
 * @returns 表单实例（SchemaFormInstance 接口）
 *
 * @example
 * ```typescript
 * // 在 setup 中使用
 * const form = useForm({
 *   columns: [...],
 *   initialValues: { name: '', email: '' },
 *   onFinish: async (values) => {
 *     await api.submit(values)
 *   },
 * })
 *
 * form.setFieldValue('name', 'John')
 * ```
 */
export function useForm<T extends FormValues>(
  options: FormInstanceOptions<T> = {}
): FormInstance<T> {
  const instance = createFormInstance<T>(options)

  // const instance = form.getForm()

  provide<FormInstance<T>>(FORM_INSTANCE_KEY, instance)

  onUnmounted(() => {
    instance.destroy()
  })

  return instance
}

export default FormInstance
