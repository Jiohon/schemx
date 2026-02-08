/**
 * FormInstance - 表单实例核心类
 *
 * 组合 Store、Parser、Validator、Subscriber，提供统一的表单操作接口。
 * 与框架无关，可在任何 JS 环境中使用。
 *
 * @module core/FormInstance
 */

import { createFormStore, FormStore } from "../core/FormStore"
import { type ParsedSchema, SchemaParser } from "../core/SchemaParser"
import { createSubscriber, Subscriber } from "../core/Subscriber"
import {
  createValidator,
  type ValidateError,
  type ValidateResult,
  Validator,
} from "../core/Validator"

import type { ColumnConfig, FormValues, SchemaFormInstance } from "../types"

export type Callbacks<T extends FormValues> = Pick<
  FormInstanceOptions<T>,
  "onValuesChange" | "onFinish" | "onFinishFailed"
>

/**
 * FormInstance 配置选项
 */
export interface FormInstanceOptions<T extends FormValues> {
  columns?: ColumnConfig[]
  initialValues?: T
  modelValue?: T
  /** 字段值更新时触发回调事件 */
  onValuesChange?: (changedValues: Partial<T>, allValues: T) => void
  /** 提交成功回调 */
  onFinish?: (values: T) => void | Promise<void>
  /** 提交失败回调 */
  onFinishFailed?: (error: ValidateError<T>) => void
}

/**
 * FormInstance 类
 */
export class FormInstance<T extends FormValues> {
  private store: FormStore<T>
  private validator: Validator
  private subscriber: Subscriber

  private callbacks: Callbacks<T> = {}
  private _schema: ParsedSchema | null = null
  private _submitting: boolean = false

  constructor(options: FormInstanceOptions<T> = {}) {
    const { columns, initialValues = {} as T } = options

    this.setCallbacks({
      onValuesChange: options.onValuesChange,
      onFinish: options.onFinish,
      onFinishFailed: options.onFinishFailed,
    })

    if (columns) {
      this._schema = SchemaParser.parse({ columns })
    }

    // 2. Store: 初始化状态管理
    const mergedInitialValues = { ...this._schema?.defaults, ...initialValues } as T
    this.store = createFormStore<T>({ initialValues: mergedInitialValues })

    // 3. Subscriber: 初始化订阅管理
    this.subscriber = createSubscriber({
      getFieldValue: (path) => this.store.getFieldValue(path),
      getFieldsValue: () => this.store.getFieldsValue(),
    })

    // 4. Validator: 初始化校验器
    this.validator = createValidator({
      store: this.store as FormStore<Record<string, any>>,
    })
    if (columns) {
      const rules = this.validator.extractRulesFromColumns(columns)
      this.validator.registerRulesFromMap(rules)
    }

    // 5. 注册值变化回调
    if (this.callbacks?.onValuesChange) {
      this.subscriber.subscribeAll((changedValues, allValues) => {
        this.callbacks.onValuesChange?.(changedValues as Partial<T>, allValues as T)
      })
    }
  }

  // ==================== Schema ====================

  get schema(): ParsedSchema | null {
    return this._schema
  }

  get columns() {
    return this._schema?.columns || []
  }

  get fieldList() {
    return this._schema?.fieldList || []
  }

  public getForm(): SchemaFormInstance<T> {
    return {
      // Schema
      schema: this._schema,

      // 值操作
      setFieldValue: (name, value) => this.setFieldValue(name, value),
      setFieldsValue: (values) => this.setFieldsValue(values),
      getFieldValue: (name) => this.store.getFieldValue(name),
      getFieldsValue: (names) => this.store.getFieldsValue(names),
      getInitialValue: (name) => this.store.getInitialValue(name),

      // 校验
      registerRules: (name, rules) => this.validator.registerRules(name, rules),
      unregisterRules: (name) => this.validator.unregisterRules(name),
      validateField: (name) => this.validateField(name),
      validate: () => this.validate(),

      getFieldError: (name) => this.validator.getFieldError(name),
      setFieldError: (name: string, errors: string[]) =>
        this.validator.setFieldError(name, errors),

      // 提交
      submit: this.submit,

      // 重置
      reset: () => this.reset(),
      resetFields: (names) => this.resetFields(names),

      // Touched 状态
      isFieldTouched: (name) => this.store.isFieldTouched(name),
      isFieldsTouched: (names) => this.store.isFieldsTouched(names),
      getTouchedFields: () => this.store.getTouchedFields(),

      // 订阅
      subscribe: (name, callback) => this.subscriber.subscribe(name, callback),
      subscribeAll: (callback) => this.subscriber.subscribeAll(callback),

      // Schema 操作
      updateSchema: (columns: ColumnConfig[]) => this.updateSchema(columns),
    }
  }

  private setCallbacks = (callbacks: Callbacks<T>) => {
    this.callbacks = callbacks
  }

  private updateSchema(columns: ColumnConfig[]): void {
    const oldRulesMap = this.validator.getRulesMap()
    this._schema = SchemaParser.parse({ columns })
    const newRulesMap = this.validator.extractRulesFromColumns(columns)
    this.validator.syncRules(oldRulesMap, newRulesMap)
  }

  // ==================== 值操作 ====================

  private setFieldValue(name: string, value: any): void {
    this.store.setFieldValue(name, value)
    // 通知订阅者
    this.subscriber.notifyField(name, value)
    this.subscriber.notifyGlobal({ [name]: value })
  }

  private setFieldsValue(values: Partial<T>): void {
    this.store.setFieldsValue(values)
    // 通知订阅者
    for (const [path, value] of Object.entries(values)) {
      this.subscriber.notifyField(path, value)
    }

    this.subscriber.notifyGlobal(values as Record<string, any>)
  }

  /**
   * 校验单个字段
   *
   * @param name - 字段名
   * @returns 校验是否通过
   */
  private async validateField(name: string | string[]): Promise<ValidateResult<T>> {
    const result = await this.validator.validateField(name)

    return result as ValidateResult<T>
  }

  /**
   * 校验表单
   *
   * @param names - 可选，指定要校验的字段名数组。不传则校验所有字段
   * @returns 校验结果，成功返回 values，失败返回 errors
   *
   * @example
   * ```typescript
   * // 校验所有字段
   * const result = await form.validate()
   * if (result.ok) {
   *   submitForm(result.values)
   * }
   *
   * // 校验指定字段
   * const result = await form.validate(['name', 'email'])
   * ```
   */
  private async validate(): Promise<ValidateResult<T>> {
    return this.validator.validate() as Promise<ValidateResult<T>>
  }

  // ==================== 重置 ====================

  private reset(): void {
    this.store.reset()
    // 通知所有订阅者
    this.subscriber.notifyGlobal(this.store.getFieldsValue())
  }

  private resetFields(names: string[]): void {
    const changedValues: Record<string, any> = {}
    names.forEach((name) => {
      this.store.resetField(name)
      changedValues[name] = this.store.getFieldValue(name)
      this.subscriber.notifyField(name, changedValues[name])
    })
    this.subscriber.notifyGlobal(changedValues)
  }

  // ==================== 提交状态 ====================

  /**
   * 检查表单是否正在提交
   *
   * @returns 是否正在提交
   */
  private isSubmitting(): boolean {
    return this._submitting
  }

  /**
   * 设置表单提交状态
   *
   * @param submitting - 是否正在提交
   */
  private setSubmitting(submitting: boolean): void {
    this._submitting = submitting
  }

  // ==================== 提交 ====================

  private submit = async (): Promise<void> => {
    try {
      this.setSubmitting(true)

      const result = await this.validate()
      if (result.ok) {
        await this.callbacks.onFinish?.(result.values)
      } else {
        this.callbacks.onFinishFailed?.(result.error)
      }
    } finally {
      this.setSubmitting(false)
    }
  }

  // ==================== 销毁 ====================

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

  // onUnmounted(() => {
  //   instance.destroy()
  // })

  return form.getForm()
}

export default FormInstance
