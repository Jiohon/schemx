/**
 * FormInstance - 表单实例核心类
 *
 * 组合 Store、Parser、Validator、Subscriber，提供统一的表单操作接口。
 * 与框架无关，可在任何 JS 环境中使用。
 *
 * @module core/FormInstance
 */
import { onUnmounted } from "vue"
import type { DeepReadonly } from "vue"

import { getInitialValuesFromColumns } from "@/utils"
import { withLock } from "@/utils/async"

import { createFormStore, FormStore } from "../core/FormStore"
import { createSubscriber, Subscriber } from "../core/Subscriber"
import {
  createValidator,
  type ValidateError,
  type ValidateResult,
  Validator,
} from "../core/Validator"

import type { FormValues, NamePath, SchemaColumn, SchemaFormInstance } from "../types"

export type Callbacks<T extends FormValues> = Pick<
  FormInstanceOptions<T>,
  "onValuesChange" | "onFinish" | "onFinishFailed"
>

/**
 * FormInstance 配置选项
 */
export interface FormInstanceOptions<T extends FormValues> {
  columns?: SchemaColumn<T>[]
  initialValues?: T
  modelValue?: T
  /** 字段值更新时触发回调事件 */
  onValuesChange?: (changedValues: Partial<T>, latestValues: T) => void
  /** 提交成功回调 */
  onFinish?: (values: DeepReadonly<T>) => void | Promise<void>
  /** 提交失败回调 */
  onFinishFailed?: (error: ValidateError<T>) => void
}

/**
 * FormInstance 类
 */
export class FormInstance<T extends FormValues = FormValues> {
  private store: FormStore<T>

  private validator: Validator<T>
  private subscriber: Subscriber<T>

  private callbacks: Callbacks<T> = {}
  private _submitting: boolean = false

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

    // 2. Store: 初始化状态管理
    this.store = createFormStore<T>({ initialValues: mergedInitialValues as T })

    // 3. Subscriber: 初始化订阅管理
    this.subscriber = createSubscriber<T>()

    // 4. Validator: 初始化校验器
    this.validator = createValidator<T>()

    if (columns) {
      this.validator.registerRulesFromColumns(columns)
    }

    // 5. 注册值变化回调
    if (this.callbacks?.onValuesChange) {
      this.subscriber.subscribeAll((changedValues, latestValues) => {
        this.callbacks.onValuesChange?.(changedValues as Partial<T>, latestValues as T)
      })
    }
  }

  /**
   * 获取表单实例的公开接口
   *
   * 将内部方法映射为 SchemaFormInstance 接口，供外部组件和 Hook 使用。
   *
   * @returns SchemaFormInstance 表单操作接口
   */
  public getForm(): SchemaFormInstance<T> {
    return {
      // 值操作
      setFieldValue: (name, value) => this.setFieldValue(name, value),
      setFieldsValue: (values) => this.setFieldsValue(values),
      getFieldValue: (name) => this.store.getFieldValue(name as NamePath<T>),
      getFieldsValue: (names) =>
        names ? this.store.getFieldsValue(names) : this.store.getFieldsValue(),

      getInitialValue: (name) => this.store.getInitialValue(name as NamePath<T>),

      // 校验
      registerRules: (name, rules) => this.validator.registerRule(name, rules),
      unregisterRules: (name) => this.validator.unregisterRule(name),
      registerRulesFromColumns: (columns) =>
        this.validator.registerRulesFromColumns(columns),
      validateField: (name) => this.validateField(name),
      validate: () => this.validate(),

      getFieldError: (name) => this.validator.getFieldError(name),
      setFieldError: (name, errors) => this.validator.setFieldError(name, errors),

      // 提交
      submit: this.submit,

      // 重置
      reset: () => this.reset(),
      resetFields: (names) => this.resetFields(names),

      // Touched 状态
      isFieldTouched: (name) => this.store.isFieldTouched(name as NamePath<T>),
      isFieldsTouched: (names) => this.store.isFieldsTouched(names),
      getTouchedFields: () => this.store.getTouchedFields(),

      // 订阅
      subscribe: (path, callback) => this.subscriber.subscribe(path, callback),
      subscribeFields: (paths, callback) =>
        this.subscriber.subscribeFields(paths, callback),
      subscribeAll: (callback) => this.subscriber.subscribeAll(callback),
      destroy: () => this.destroy(),
    }
  }

  /** 设置回调函数 */
  private setCallbacks = (callbacks: Callbacks<T>) => {
    this.callbacks = callbacks
  }

  /**
   * 统一的通知入口
   *
   * 将变化值和当前全量值传递给 Subscriber 进行分发，避免重复获取 allValues。
   *
   * @param newValues - 已变化的字段值对象
   */
  private notify(
    newValues: DeepReadonly<Partial<T>>,
    prevValues: DeepReadonly<Partial<T>>
  ): void {
    this.subscriber.notify(newValues, prevValues, this.store.getFieldsValue())
  }

  /**
   * 设置单个字段值并通知订阅者
   *
   * @param name - 字段路径
   * @param value - 字段值
   */
  private setFieldValue(name: NamePath<T>, value: T): void {
    const prevValue = this.store.getFieldValue(name)
    this.store.setFieldValue(name, value)

    const values = { [name as keyof T]: value } as DeepReadonly<Partial<T>>
    const oldvalues = { [name as keyof T]: prevValue } as DeepReadonly<Partial<T>>

    this.notify(values, oldvalues)
  }

  /**
   * 批量设置字段值并通知订阅者
   *
   * @param values - 要设置的字段值对象
   */
  private setFieldsValue(values: DeepReadonly<Partial<T>>): void {
    const prevValues = this.store.getFieldsValue()
    this.store.setFieldsValue(values)
    this.notify(values, prevValues)
  }

  /**
   * 校验指定字段
   *
   * 从 store 获取当前全量值传入 Validator 进行校验。
   *
   * @param name - 字段名或字段名数组
   * @returns 校验结果
   */
  private async validateField(name: string | string[]): Promise<ValidateResult<T>> {
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
   *
   * @returns 校验结果，成功返回 values，失败返回 errors
   */
  private async validate(): Promise<ValidateResult<T>> {
    try {
      this.setSubmitting(true)

      const result = await this.validator.validate(this.store.getFieldsValue())

      return result
    } finally {
      this.setSubmitting(false)
    }
  }

  /**
   * 重置整个表单到初始值并通知订阅者
   */
  private reset(): void {
    const prevValues = this.store.getFieldsValue()
    this.store.reset()
    const latestValues = this.store.getFieldsValue()
    this.notify(latestValues, prevValues)
  }

  /**
   * 重置指定字段到初始值并通知订阅者
   *
   * @param names - 要重置的字段路径数组
   */
  private resetFields(names: NamePath<T>[]): void {
    const prevValues = this.store.getFieldsValue()

    names.forEach((name) => {
      this.store.resetField(name)
    })
    const newValues = this.store.getFieldsValue(names)

    this.notify(newValues, prevValues)
  }

  /** 检查表单是否正在提交 */
  private isSubmitting(): boolean {
    return this._submitting
  }

  /** 设置表单提交状态 */
  private setSubmitting(submitting: boolean): void {
    this._submitting = submitting
  }

  /**
   * 提交表单
   *
   * 通过 withLock 防止重复提交，提交进行中时返回同一个 Promise。
   * 校验通过调用 onFinish，失败调用 onFinishFailed。
   */
  private submit = withLock(async (): Promise<void> => {
    const result = await this.validate()
    if (result.ok) {
      await this.callbacks.onFinish?.(result.values)
    } else {
      this.callbacks.onFinishFailed?.(result.error)
    }
  })

  /** 销毁表单实例，清除所有订阅 */
  private destroy(): void {
    this.subscriber.clear()
  }
}

/**
 * 创建 FormInstance
 */
export function createFormInstance<T extends FormValues>(
  options: FormInstanceOptions<T> = {}
): FormInstance<T> {
  return new FormInstance<T>(options)
}

/**
 * 创建表单 Hook
 */
export function useForm<T extends FormValues>(
  options: FormInstanceOptions<T> = {}
): SchemaFormInstance<T> {
  const form = createFormInstance<T>(options)

  const instance = form.getForm()

  onUnmounted(() => {
    instance.destroy()
  })

  return instance
}

export default FormInstance
