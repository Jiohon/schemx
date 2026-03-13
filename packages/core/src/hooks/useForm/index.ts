/**
 * SchemaFormInstance - 表单实例核心类
 *
 * 组合 Store、Validator、Subscriber，提供统一的表单操作接口。
 * 实现 SchemaFormInstance 接口，作为 useForm 的底层实现。
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
import { inject, onUnmounted, provide } from "vue"
import type { DeepReadonly } from "vue"

import {
  createLocalSchemaRegistry,
  defineSchemas,
  schemaRegistry,
  SchemaRegistry,
} from "@/core/schemaRegistry"
import { createFormStore, FormStore } from "@/core/store"
import {
  createSubscriber,
  type FieldsSubscribeCallback,
  FieldSubscribeCallback,
  GlobalSubscribeCallback,
  Subscriber,
} from "@/core/subscriber"
import {
  createValidator,
  type ValidateError,
  type ValidateResult,
  Validator,
} from "@/core/validator"
import type {
  FormValues,
  NamePath,
  Rules,
  SchemaBaseColumnUnion,
  SchemaColumn,
  SchemaFormInstance,
  Value,
} from "@/types"
import type { StandardSchemaV1 } from "@/types/standardSchema"
import { withLock } from "@/utils/async"
import { findColumn } from "@/utils/column"
import { collectObjectPathsByLeaf } from "@/utils/path"
import {
  createRequiredSchema,
  createSelectRequiredSchema,
  createUploadRequiredSchema,
} from "@/utils/standardSchema"

/**
 * 表单回调函数集合
 *
 * 从 CreateFormInstanceOptions 中提取的回调函数子集，用于内部存储。
 *
 * @typeParam T - 表单值类型
 */
type Callbacks<T extends FormValues> = Pick<
  CreateFormInstanceOptions<T>,
  "onValuesChange" | "onFinish" | "onFinishFailed" | "onFieldsChange"
>

/**
 * SchemaFormInstance 配置选项
 *
 * @typeParam T - 表单值类型
 */
export interface CreateFormInstanceOptions<T extends FormValues> {
  /** 表单列配置，用于提取初始值和校验规则 */
  columns?: SchemaColumn<T>[]
  /** 初始值，与 columns 中的 initialValue 合并 */
  initialValues?: T
  /** 双向绑定的表单值（v-model） */
  modelValue?: T

  /** 表单提交校验通过后的回调 */
  onFinish?: (values: DeepReadonly<T>) => void | Promise<void>
  /** 表单提交校验失败后的回调 */
  onFinishFailed?: (error: ValidateError<T>) => void
  /** 字段值更新时触发的回调 */
  onValuesChange?: (
    changedValues: DeepReadonly<Partial<T>>,
    latestSnapshot: DeepReadonly<T> | T
  ) => void
  /** 字段更新时触发的回调 */
  onFieldsChange?: (changedFields: NamePath<T>[], allFields: NamePath<T>[]) => void
}

/** SchemaFormInstance 在 Vue provide/inject 中的注入 key */
export const FORM_INSTANCE_KEY = Symbol("SchemaFormInstance")

/**
 * 表单实例核心类
 *
 * 组合 FormStore（状态管理）、Validator（校验）、Subscriber（订阅）三个模块，
 * 对外提供统一的表单操作 API。实现 SchemaFormInstance 接口。
 *
 * @typeParam T - 表单值类型，默认为 FormValues
 *
 * @example
 * ```typescript
 * const form = new SchemaFormInstance({
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
class CreateFormInstance<T extends FormValues = FormValues> {
  /** 表单列配置，用于提取初始值和校验规则 */
  private columns: SchemaColumn<T>[]

  /** 表单状态存储，管理字段值和初始值 */
  private store: FormStore<T>

  /** 表单校验器，管理校验规则和错误信息 */
  private validator: Validator<T>

  /** 发布订阅管理器，管理字段级和全局订阅 */
  private subscriber: Subscriber<T>

  /** 校验规则注册中心，管理校验规则和错误信息 */
  private schemaRegistry: SchemaRegistry<T>

  /** 回调函数集合（onValuesChange / onFinish / onFinishFailed / onFieldsChange */
  private callbacks: Callbacks<T> = {}

  /**
   * 创建 SchemaFormInstance 实例
   *
   * 初始化 Store、Subscriber、Validator 三个核心模块，
   *
   * @param options - 表单配置选项
   *
   * @example
   * ```typescript
   * const form = new SchemaFormInstance({
   *   initialValues: { email: '' },
   * })
   * ```
   */

  constructor(options: CreateFormInstanceOptions<T> = {}) {
    const { initialValues = {} as T, columns = [] as SchemaColumn<T>[] } = options
    this.columns = columns

    this.setCallbacks({
      onValuesChange: options.onValuesChange,
      onFinish: options.onFinish,
      onFinishFailed: options.onFinishFailed,
      onFieldsChange: options.onFieldsChange,
    })

    // 注册内置校验 schema 工厂
    defineSchemas({
      required: createRequiredSchema,
      selectRequired: createSelectRequiredSchema,
      uploadRequired: createUploadRequiredSchema,
    })

    // SchemaRegistry: 创建局部注册中心，继承全局规则
    this.schemaRegistry = createLocalSchemaRegistry<T>(schemaRegistry)

    // Store: 初始化状态管理
    this.store = createFormStore<T>({ initialValues })

    // Subscriber: 初始化订阅管理
    this.subscriber = createSubscriber<T>()

    // Validator: 初始化校验器
    this.validator = createValidator<T>()

    // 注册值变化回调
    if (this.callbacks?.onValuesChange || this.callbacks?.onFieldsChange) {
      this.subscriber.subscribeAll((payload, _prevSnapshot, latestSnapshot) => {
        this.callbacks.onValuesChange?.(payload.changedValues, latestSnapshot)

        this.callbacks?.onFieldsChange?.(
          payload.changedPaths,
          collectObjectPathsByLeaf(latestSnapshot)
        )
      })
    }
  }

  /**
   * 导出符合 SchemaFormInstance 接口的纯对象
   *
   * 将类实例的公共方法绑定到当前实例后，以普通对象形式返回。
   *
   * @returns  SchemaFormInstance 对象
   *
   * @remarks
   * `createFormInstance` 通过 `new CreateFormInstance(options).getForm()` 调用此方法，
   */
  public getForm = (): SchemaFormInstance<T> => ({
    setFieldValue: this.setFieldValue.bind(this),
    setFieldsValue: this.setFieldsValue.bind(this),
    getFieldValue: this.getFieldValue.bind(this),
    getFieldsValue: this.getFieldsValue.bind(this),
    getFieldsSnapshot: this.getFieldsSnapshot.bind(this),
    getInitialValues: this.getInitialValues.bind(this),
    setInitialValues: this.setInitialValues.bind(this),
    registerRules: this.registerRules.bind(this),
    unregisterRules: this.unregisterRules.bind(this),
    validateField: this.validateField.bind(this),
    validate: this.validate.bind(this),
    getFieldError: this.getFieldError.bind(this),
    setFieldError: this.setFieldError.bind(this),
    isFieldTouched: this.isFieldTouched.bind(this),
    isFieldsTouched: this.isFieldsTouched.bind(this),
    getTouchedFields: this.getTouchedFields.bind(this),
    subscribe: this.subscribe.bind(this),
    subscribeFields: this.subscribeFields.bind(this),
    subscribeAll: this.subscribeAll.bind(this),
    reset: this.reset.bind(this),
    resetFields: this.resetFields.bind(this),
    submit: this.submit.bind(this),
    destroy: this.destroy.bind(this),
  })

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
   */
  private setFieldValue(name: NamePath<T>, value: Value): void {
    const prevSnapshot = this.store.getFieldsSnapshot()

    this.store.setFieldValue(name, value)

    const values = this.store.getFieldsValue([name])

    this.notify(values, prevSnapshot, this.store.getFieldsSnapshot())
  }

  /**
   * 批量设置字段值并通知订阅者
   */
  private setFieldsValue(values: DeepReadonly<Partial<T>>): void {
    const prevSnapshot = this.store.getFieldsSnapshot()

    this.store.setFieldsValue(values)

    this.notify(values, prevSnapshot, this.store.getFieldsSnapshot())
  }

  /**
   * 获取单个字段的当前值
   */
  private getFieldValue(path: NamePath<T>): DeepReadonly<Value> {
    return this.store.getFieldValue(path)
  }

  /**
   * 获取多个字段的值
   */
  private getFieldsValue(paths?: NamePath<T>[]): any {
    if (paths) {
      return this.store.getFieldsValue(paths)
    }

    return this.store.getFieldsValue()
  }

  /**
   * 获取当前表单值的快照
   */
  private getFieldsSnapshot(): T {
    return this.store.getFieldsSnapshot()
  }

  /**
   * 获取字段的初始值
   */
  private getInitialValues(paths?: NamePath<T>[]): T | Partial<T> {
    if (!paths) {
      return this.store.getInitialValues()
    }

    return this.store.getInitialValues(paths)
  }

  /**
   * 设置字段的初始值
   */
  private setInitialValues(values: Partial<T>): void {
    this.store.setInitialValues(values)
  }

  /**
   * 注册字段校验规则
   */
  private registerRules(
    path: NamePath<T>,
    rules: Rules | Rules[],
    defaultMessage?: string
  ): void {
    const column = findColumn(this.columns, String(path))

    const resolved = this.resolveRules(rules, column)

    if (resolved.length > 0) {
      this.validator.registerRules(path, resolved, defaultMessage)
    }
  }

  /**
   * 将 Rules | Rules[] 解析为 StandardSchemaV1 数组。
   *
   * 字符串规则通过 schemaRegistry 查找，StandardSchemaV1 实例直接保留。
   *
   * @param rules - 原始规则（单个或数组）
   * @param column - 字段列配置，传递给工厂函数
   *
   * @returns 解析后的 StandardSchemaV1 数组
   */
  private resolveRules(
    rules: Rules | Rules[],
    column?: SchemaBaseColumnUnion<T>
  ): StandardSchemaV1[] {
    const list = Array.isArray(rules) ? rules : [rules]
    const resolved: StandardSchemaV1[] = []

    for (const rule of list) {
      if (typeof rule === "string") {
        if (this.schemaRegistry.hasSchema(rule)) {
          const schema = this.schemaRegistry.resolve(rule, column)
          if (schema) resolved.push(schema)
        } else {
          console.warn(`[SchemaForm] 未找到名为 "${rule}" 的校验规则`)
        }
      } else {
        resolved.push(rule)
      }
    }

    return resolved
  }

  /**
   * 注销字段校验规则
   */
  private unregisterRules(path: NamePath<T>): void {
    this.validator.unregisterRules(path)
  }

  /**
   * 获取指定字段的错误信息
   */
  private getFieldError(path: NamePath<T>): string[] | undefined {
    return this.validator.getFieldError(path)
  }

  /**
   * 手动设置字段的错误信息
   */
  private setFieldError(path: NamePath<T>, errors: string[]): void {
    this.validator.setFieldError(path, errors)
  }

  /**
   * 检查单个字段是否被修改
   */
  private isFieldTouched(path: NamePath<T>): boolean {
    return this.store.isFieldTouched(path)
  }

  /**
   * 检查多个字段是否被修改
   */
  private isFieldsTouched(path?: NamePath<T>[]): boolean {
    return this.store.isFieldsTouched(path)
  }

  /**
   * 获取所有被修改的字段路径
   */
  private getTouchedFields(): string[] {
    return this.store.getTouchedFields()
  }

  /**
   * 订阅单个字段变化
   */
  private subscribe(path: NamePath<T>, callback: FieldSubscribeCallback<T>): () => void {
    return this.subscriber.subscribe(path, callback)
  }

  /**
   * 订阅多个字段变化
   */
  private subscribeFields(
    paths: NamePath<T>[],
    callback: FieldsSubscribeCallback<T>
  ): () => void {
    return this.subscriber.subscribeFields(paths, callback)
  }

  /**
   * 订阅所有字段变化
   */
  private subscribeAll(callback: GlobalSubscribeCallback<T>): () => void {
    return this.subscriber.subscribeAll(callback)
  }

  /**
   * 批量通知所有相关订阅者（字段级、多字段组、全局）。
   *
   * 依次执行：逐字段精确通知 → 多字段组通知 → 全局通知。
   *
   * @param changedValues - 已变化的字段值对象（部分）
   * @param prevSnapshot - 变化前的全量值快照
   * @param latestSnapshot - 变化后的全量值快照
   */
  private notify(
    changedValues: DeepReadonly<Partial<T>>,
    prevSnapshot: T,
    latestSnapshot: T
  ): void {
    this.subscriber.notify(changedValues, prevSnapshot, latestSnapshot)
  }

  /**
   * 校验指定字段
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
   */
  private validate = withLock(async (): Promise<ValidateResult<T>> => {
    const result = await this.validator.validate(this.store.getFieldsValue())

    return result
  })

  /**
   * 重置指定字段到初始值并通知订阅者
   */
  private resetFields(names: NamePath<T>[]): void {
    const prevSnapshot = this.store.getFieldsSnapshot()

    names.forEach((name) => {
      this.store.resetField(name)
    })
    const newValues = this.store.getFieldsValue(names)

    this.notify(newValues, prevSnapshot, prevSnapshot)
  }

  /**
   * 重置整个表单到初始值并通知订阅者
   */
  private reset(): void {
    const prevSnapshot = this.store.getFieldsSnapshot()
    this.store.reset()
    this.validator.resetErrors()
    const latestValues = this.store.getFieldsValue()
    this.notify(latestValues, prevSnapshot, this.store.getFieldsSnapshot())
  }

  /**
   * 提交表单
   */
  private submit = withLock(async (): Promise<void> => {
    const result = await this.validate()
    if (result.ok) {
      await this.callbacks.onFinish?.(result.values)
    } else {
      this.callbacks.onFinishFailed?.(result.error)
    }
  })
  /**
   * 销毁表单实例
   *
   * 清除所有订阅回调，释放资源。通常在组件卸载时调用。
   */
  private destroy(): void {
    this.subscriber.clear()
  }
}

/**
 * 创建 SchemaFormInstance 实例的工厂函数
 *
 * @typeParam T - 表单值类型
 *
 * @param options - 表单配置选项
 * @returns SchemaFormInstance 实例
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
  options: CreateFormInstanceOptions<T> = {}
): SchemaFormInstance<T> {
  return new CreateFormInstance<T>(options).getForm()
}

/**
 * 表单组合式函数
 *
 * 创建 SchemaFormInstance 并通过 Vue provide 注入到子组件树中，
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
  options: CreateFormInstanceOptions<T> = {}
): SchemaFormInstance<T> {
  const instance = createFormInstance<T>(options)

  provide<SchemaFormInstance<T>>(FORM_INSTANCE_KEY, instance)

  onUnmounted(() => {
    instance.destroy()
  })

  return instance
}

/**
 * 获取表单实例
 *
 * 在子组件中获取 useForm 创建的 SchemaFormInstance，
 * 可用于读写字段值、校验、订阅等操作。
 *
 * @typeParam T - 表单值类型
 * @returns 表单实例
 *
 * @throws Error 如果不在 SchemaForm 提供的上下文中调用
 *
 * @example
 * ```ts
 * const form = useFormInstance()
 * form.setFieldValue('name', 'hello')
 * ```
 */
export function useFormInstance<
  T extends FormValues = FormValues,
>(): SchemaFormInstance<T> {
  const instance = inject<SchemaFormInstance<T>>(FORM_INSTANCE_KEY)

  if (!instance) {
    throw new Error("useFormInstance must be used within a Form")
  }

  return instance
}

export default useForm
