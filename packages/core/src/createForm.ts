/**
 * 表单实例工厂 - 框架无关的核心实现
 *
 * 组合 Store、Validator，提供统一的表单操作接口。
 * 订阅能力由 Store 内部的 Signal 机制提供。
 *
 * @module core/createForm
 *
 * @example
 * ```typescript
 * import { createForm } from '@schemx/core'
 *
 * const form = createForm({
 *   initialValues: { name: '', age: 0 },
 *   onFinish: (values) => console.log(values),
 * })
 *
 * form.setFieldValue('name', 'John')
 * await form.submit()
 * ```
 */
import { batch as signalBatch, effect as signalEffect } from "@preact/signals-core"

import {
  createRendererRegistry,
  createRulesRegistry,
  RendererRegistry,
  type RuleEntry,
  type RulesRegistry,
} from "./registry"
import { type BatchScheduler, createBatchScheduler } from "./scheduler"
import { filterSchemas } from "./schemas"
import { createFormStore, FormStore, FormStorePendingField } from "./store"
import { collectObjectPathsByLeaf, diff, findSchema, getByPath, withLock } from "./utils"
import {
  createRequiredRule,
  createSelectRequiredRule,
  createUploadRequiredRule,
  createValidator,
  type ValidateError,
  type ValidateResult,
  Validator,
} from "./validator"

import type {
  NamePath,
  SchemxBaseField,
  SchemxField,
  SchemxInstance,
  SchemxInternalHooks,
  SchemxRendererKey,
  SchemxRules,
  StandardSchemaV1,
  Value,
  Values,
} from "./types"

/**
 * 表单回调函数集合
 *
 * 从 CreateFormOptions 中提取的回调函数子集，用于内部存储。
 *
 * @typeParam T - 表单值类型
 */
type Callbacks<T extends Values> = Pick<
  CreateFormOptions<T>,
  "onValuesChange" | "onFinish" | "onFinishFailed" | "onFieldsChange"
>

/**
 * 表单实例配置选项
 *
 * 用于 createForm 工厂函数的参数，定义表单的初始状态和回调。
 *
 * @typeParam T - 表单值类型
 */
export interface CreateFormOptions<T extends Values> {
  /** 表单列配置，用于提取初始值和校验规则 */
  schemas?: SchemxField<T>[]
  /** 初始值，与 schemas 中的 initialValue 合并 */
  initialValues?: T
  /** 双向绑定的表单值（v-model） */
  modelValue?: T
  /** 渲染器注册实例 */
  rendererRegistry?: RendererRegistry
  /** 默认渲染器类型，当字段未指定 renderer 时使用 */
  defaultRendererType?: SchemxRendererKey<T>
  /** 规则注册实例 */
  rulesRegistry?: RulesRegistry

  /** 表单提交校验通过后的回调 */
  onFinish?: (values: Readonly<T>) => void | Promise<void>
  /** 表单提交校验失败后的回调 */
  onFinishFailed?: (error: ValidateError<T>) => void
  /** 字段值更新时触发的回调 */
  onValuesChange?: (
    changedValues: Readonly<Partial<T>>,
    latestSnapshot: Readonly<T> | T
  ) => void
  /** 字段更新时触发的回调 */
  onFieldsChange?: (changedFields: NamePath<T>[], allFields: NamePath<T>[]) => void
}

/**
 * 表单实例核心类
 *
 * 组合 FormStore（状态管理 + 订阅）和 Validator（校验）两个模块，
 * 对外提供统一的表单操作 API。实现 SchemxInstance 接口。
 *
 * @typeParam T - 表单值类型，默认为 Values
 *
 * @example
 * ```typescript
 * const form = new CreateForm({
 *   initialValues: { name: '', email: '' },
 *   onFinish: (values) => api.submit(values),
 * })
 *
 * const instance = form.getForm()
 * instance.setFieldValue('name', 'John')
 * await instance.submit()
 * ```
 *
 * @remarks
 * 内部通过 Store 的 Signal 机制实现发布-订阅，所有值变更自动通知相关订阅者。
 * 提交操作通过 withLock 防止重复提交。
 */
class CreateForm<T extends Values = Values> {
  /** 表单列配置，用于提取初始值和校验规则 */
  private schemas: SchemxField<T>[]

  /** 表单状态存储，管理字段值、初始值和订阅 */
  private store: FormStore<T>

  /** 表单校验器，管理校验规则和错误信息 */
  private validator: Validator<T>

  /** 校验规则注册中心，管理校验规则和错误信息 */
  private rulesRegistry: RulesRegistry<T>

  /** 渲染器注册中心，管理组件类型到渲染器的映射 */
  private rendererRegistry: RendererRegistry

  /** 回调函数集合（onValuesChange / onFinish / onFinishFailed / onFieldsChange） */
  private callbacks: Callbacks<T> = {}

  /** 所有 effect 的 dispose 函数，destroy 时统一清理 */
  private disposers = new Set<() => void>()

  /** 字段初始化批量调度器，将多个 FormItem 的 onMounted 初始化合并为一次 signalBatch */
  private scheduler: BatchScheduler<{ name: NamePath<T>; value: Value }>

  /**
   * 创建表单实例
   *
   * 初始化 Store 和 Validator 两个核心模块。
   *
   * @param options - 表单配置选项
   */
  constructor(options: CreateFormOptions<T>) {
    const {
      initialValues = {} as T,
      schemas = [] as SchemxField<T>[],
      rendererRegistry,
      defaultRendererType,
      rulesRegistry,
    } = options || {}

    this.schemas = filterSchemas(schemas)

    this.rendererRegistry =
      rendererRegistry ?? createRendererRegistry(defaultRendererType)

    this.rulesRegistry = (rulesRegistry ?? createRulesRegistry<T>()) as RulesRegistry<T>

    this.setCallbacks({
      onValuesChange: options.onValuesChange,
      onFinish: options.onFinish,
      onFinishFailed: options.onFinishFailed,
      onFieldsChange: options.onFieldsChange,
    })

    // 注册内置校验规则
    this.rulesRegistry.registerAll({
      required: createRequiredRule,
      selectRequired: createSelectRequiredRule,
      uploadRequired: createUploadRequiredRule,
    } as Record<string, RuleEntry<T>>)

    // Store: 初始化状态管理（含订阅能力）
    this.store = createFormStore<T>({ initialValues })

    // Validator: 初始化校验器
    this.validator = createValidator<T>()

    // 初始化批量调度器：收集多个 FormItem 的 onMounted 初始化，microtask 时统一 batch flush
    this.scheduler = createBatchScheduler<{
      name: SchemxBaseField["name"]
      value: Value
    }>({
      flush: (tasks) => {
        signalBatch(() => {
          for (const t of tasks) {
            this.store.setInitialValues({ [t.name]: t.value } as Partial<T>)
            this.store.setFieldValue(t.name as NamePath<T>, t.value)
          }
        })
      },
      dedupKey: (t) => t.name,
    })

    // 注册值变化回调（通过 store.effect 自动追踪依赖）
    if (this.callbacks?.onValuesChange || this.callbacks?.onFieldsChange) {
      let prevSnapshot = this.store.getFieldsSnapshot()

      signalEffect(() => {
        const latestValues = this.store.getFieldsValue()
        const latestSnapshot = this.store.getFieldsSnapshot()

        const changedValues = diff(latestSnapshot, prevSnapshot)

        const changedPaths = collectObjectPathsByLeaf<NamePath<T>>(changedValues)

        if (changedPaths.length > 0) {
          this.callbacks.onValuesChange?.(changedValues, latestSnapshot)

          this.callbacks.onFieldsChange?.(
            changedPaths,
            collectObjectPathsByLeaf(latestValues)
          )
        }

        prevSnapshot = latestSnapshot
      })
    }
  }

  /**
   * 导出符合 SchemxInstance 接口的纯对象
   *
   * 将类实例的公共方法绑定到当前实例后，以普通对象形式返回。
   *
   * @returns SchemxInstance 对象
   */
  public getForm = (): SchemxInstance<T> => ({
    getSchemas: this.getSchemas.bind(this),
    // Store - 值操作
    setFieldValue: this.setFieldValue.bind(this),
    setFieldsValue: this.setFieldsValue.bind(this),
    getFieldValue: this.getFieldValue.bind(this),
    getFieldsValue: this.getFieldsValue.bind(this),
    getFieldSnapshot: this.getFieldSnapshot.bind(this),
    getFieldsSnapshot: this.getFieldsSnapshot.bind(this),
    getInitialValues: this.getInitialValues.bind(this),
    setInitialValues: this.setInitialValues.bind(this),

    // Store - touched 状态
    isFieldTouched: this.isFieldTouched.bind(this),
    isFieldsTouched: this.isFieldsTouched.bind(this),
    getTouchedFields: this.getTouchedFields.bind(this),

    // Pending - 操作中状态
    setFieldPending: this.setFieldPending.bind(this),
    isFieldPending: this.isFieldPending.bind(this),
    getPendingFields: this.getPendingFields.bind(this),

    // Validator - 校验
    registerRules: this.registerRules.bind(this),
    unregisterRules: this.unregisterRules.bind(this),
    validateField: this.validateField.bind(this),
    validate: this.validate.bind(this),
    getFieldError: this.getFieldError.bind(this),
    setFieldError: this.setFieldError.bind(this),

    // 表单操作
    resetFields: this.resetFields.bind(this),
    reset: this.reset.bind(this),
    submit: this.submit.bind(this),

    // Signal - effect / batch
    effect: this.effect.bind(this),
    batch: this.batch.bind(this),

    // 生命周期
    destroy: this.destroy.bind(this),

    // 内部方法
    getInternalHooks: this.getInternalHooks.bind(this),
  })

  /**
   * 获取内部钩子
   *
   * 返回渲染器注册和校验规则注册等内部操作的钩子对象。
   */
  private getInternalHooks = (): SchemxInternalHooks<T> => ({
    // RendererRegistry - 渲染器
    getRenderer: this.getRenderer.bind(this),
    registerRenderer: this.registerRenderer.bind(this),
    hasRenderer: this.hasRenderer.bind(this),

    // RulesRegistry - 校验规则
    getRule: this.getRule.bind(this),
    registerRule: this.registerRule.bind(this),
    hasRule: this.hasRule.bind(this),
  })

  /**
   * 获取过滤后的 schemas 列表
   *
   * @returns schemas
   */
  private getSchemas(): SchemxField<T>[] {
    return this.schemas
  }

  /**
   * 设置回调函数
   *
   * @param callbacks - 回调函数集合
   */
  private setCallbacks(callbacks: Callbacks<T>): void {
    this.callbacks = callbacks
  }

  /**
   * 设置单个字段值（Store 内部自动通知订阅者）
   */
  private setFieldValue(name: NamePath<T>, value: Value): void {
    this.store.setFieldValue(name, value)
  }

  /**
   * 批量设置字段值（Store 内部自动通知订阅者）
   */
  private setFieldsValue(values: Readonly<Partial<T>>): void {
    this.store.setFieldsValue(values as Partial<T>)
  }

  /**
   * 获取单个字段的当前值
   */
  private getFieldValue(path: NamePath<T>): Readonly<Value> {
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
   * 获取单个字段值的快照
   */
  private getFieldSnapshot(path: NamePath<T>): Value {
    return this.store.getFieldSnapshot(path)
  }

  /**
   * 获取当前表单值的快照
   */
  private getFieldsSnapshot(paths?: NamePath<T>[]): any {
    return this.store.getFieldsSnapshot(paths as any)
  }

  /**
   * 获取字段的初始值
   */
  private getInitialValues(paths?: NamePath<T>[]): any {
    if (!paths) {
      return this.store.getInitialValues()
    }

    return this.store.getInitialValues(paths)
  }

  /**
   * 设置字段的初始值
   */
  private setInitialValues(values: Partial<T>): void {
    const paths = collectObjectPathsByLeaf<NamePath<T>>(values)

    for (const path of paths) {
      this.scheduler.batch({ name: path, value: getByPath(values, path) })
    }
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
   * 设置字段的操作中状态
   */
  private setFieldPending(name: NamePath<T>, pending: boolean, message?: string): void {
    this.store.setFieldPending(name, pending, message)
  }

  /**
   * 检查单个字段是否处于操作中
   */
  private isFieldPending(name: NamePath<T>): boolean {
    return this.store.isFieldPending(name)
  }

  /**
   * 获取所有处于操作中的字段路径
   */
  private getPendingFields(): FormStorePendingField[] {
    return this.store.getPendingFields()
  }

  /**
   * 将 SchemxRules | SchemxRules[] 解析为 StandardSchemaV1 数组
   *
   * 字符串规则通过 rulesRegistry 查找，StandardSchemaV1 实例直接保留。
   *
   * @param rules - 原始规则（单个或数组）
   * @param schema - 字段列配置，传递给工厂函数
   *
   * @returns 解析后的 StandardSchemaV1 数组
   */
  private resolveRules(
    rules: SchemxRules | SchemxRules[],
    schema?: SchemxBaseField<T>
  ): StandardSchemaV1[] {
    const list = Array.isArray(rules) ? rules : [rules]
    const resolved: StandardSchemaV1[] = []

    for (const rule of list) {
      if (typeof rule === "string") {
        if (this.rulesRegistry.hasRule(rule)) {
          const schemaRule = this.rulesRegistry.resolve(rule, schema)

          if (schemaRule) resolved.push(schemaRule)
        } else {
          console.warn(`[schemx] 未找到名为 "${rule}" 的校验规则`)
        }
      } else {
        resolved.push(rule)
      }
    }

    return resolved
  }

  /**
   * 注册字段校验规则
   */
  private registerRules(
    path: NamePath<T>,
    rules: SchemxRules | SchemxRules[],
    defaultMessage?: string
  ): void {
    const schema = findSchema(this.schemas, path)

    const resolved = this.resolveRules(rules, schema)

    if (resolved.length > 0) {
      this.validator.registerRules(path, resolved, defaultMessage)
    }
  }

  /**
   * 注销字段校验规则
   */
  private unregisterRules(path: NamePath<T>): void {
    this.validator.unregisterRules(path)
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
   *
   * 校验前检查是否有字段处于操作中状态，有则直接返回失败结果。
   */
  private validate = withLock(async (): Promise<ValidateResult<T>> => {
    const pendingFields = this.store.getPendingFields()

    if (pendingFields.length > 0) {
      const defaultMessage = `存在正在操作中的字段: ${pendingFields.map((i) => i.field).join(", ")}，请等待完成后再提交`

      console.warn(`[schemx] ${defaultMessage}`)

      return {
        ok: false,
        error: {
          errors: pendingFields.map(({ field, message }) => {
            this.setFieldError(field as NamePath<T>, [message])

            return {
              field,
              message: [message],
            }
          }),
          values: this.store.getFieldsSnapshot(),
        },
      }
    }

    const result = await this.validator.validate(this.store.getFieldsValue())

    return result
  })

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
   * 获取指定类型的渲染器组件
   */
  private getRenderer(type: SchemxRendererKey<T>): unknown | undefined {
    return this.rendererRegistry.getRenderer(type)
  }

  /**
   * 注册渲染器组件
   */
  private registerRenderer(type: SchemxRendererKey<T>, renderer: unknown): void {
    this.rendererRegistry.register(type, renderer)
  }

  /**
   * 检查指定类型的渲染器是否已注册
   */
  private hasRenderer(type: SchemxRendererKey<T>): boolean {
    return this.rendererRegistry.hasRenderer(type)
  }

  /**
   * 获取指定名称的校验规则条目
   */
  private getRule(name: string): RuleEntry<T> | undefined {
    return this.rulesRegistry.getRule(name)
  }

  /**
   * 注册校验规则
   */
  private registerRule(name: string, rule: RuleEntry<T>): void {
    this.rulesRegistry.register(name, rule)
  }

  /**
   * 检查指定名称的校验规则是否已注册
   */
  private hasRule(name: string): boolean {
    return this.rulesRegistry.hasRule(name)
  }

  /**
   * 重置指定字段到初始值
   */
  private resetFields(names: NamePath<T>[]): void {
    names.forEach((name) => {
      this.store.resetField(name)
    })
  }

  /**
   * 重置整个表单到初始值
   */
  private reset(): void {
    this.store.reset()
    this.validator.reset()
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
   * 创建 Signal effect，直接使用 @preact/signals-core 的 effect。
   *
   * 回调内调用 getFieldValue / getFieldError 时自动追踪依赖，
   * 跨越 store 和 validator 两个 SignalMap。
   * dispose 函数由 createForm 层面统一管理，destroy 时清理。
   */
  private effect(fn: () => void): () => void {
    const dispose = signalEffect(fn)
    this.disposers.add(dispose)

    return () => {
      dispose()
      this.disposers.delete(dispose)
    }
  }

  /**
   * 批量更新，直接使用 @preact/signals-core 的 batch。
   *
   * 将多次 signal 写入合并为一次 effect 触发，
   * 跨越 store 和 validator 两个 SignalMap。
   */
  private batch(fn: () => void): void {
    signalBatch(fn)
  }

  /**
   * 销毁表单实例
   *
   * 清除所有订阅回调和 effect，释放资源。通常在组件卸载时调用。
   */
  private destroy(): void {
    for (const dispose of this.disposers) {
      dispose()
    }

    this.disposers.clear()
    this.store.destroy()
  }
}

/**
 * 创建 SchemxInstance 实例的工厂函数
 *
 * 组合 FormStore、Validator 提供统一的表单操作接口。
 * 框架无关，可在任意 JavaScript 运行时中使用。
 *
 * @typeParam T - 表单值类型
 *
 * @param options - 表单配置选项
 * @returns 符合 SchemxInstance 接口的表单实例
 *
 * @example
 * ```typescript
 * const form = createForm({
 *   initialValues: { name: 'John' },
 *   onFinish: (values) => console.log(values),
 * })
 * ```
 */
export function createForm<T extends Values>(
  options: CreateFormOptions<T>
): SchemxInstance<T> {
  return new CreateForm<T>(options).getForm()
}
