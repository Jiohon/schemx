/**
 * 表单组件 Props 类型
 *
 * 定义 schemx 组件及 FormItem 组件的 Props 接口。
 *
 * @module types/form
 */

import { DeepNamePath, PathValue } from "./namePathType"
import { SchemxRendererKey } from "./renderer"
import { SchemxRules } from "./rule"

import type { StorePending } from "../store"
import type { SchemxField } from "./schema"
import type { RendererRegistry, RuleEntry, RulesRegistry } from "../registry"
import type { ValidateError, ValidateResult } from "../validator"
import type { ViewNode } from "../view"

/** 字段值类型 */
export type Value = unknown

/** 表单值类型，键值对结构 */
export type Values = Record<string, any>

/**
 * 动态属性类型
 *
 * 支持静态值或函数形式，函数接收当前表单值并返回属性值（支持异步）。
 */
export type Dynamic<T, V extends Values = Values> = ((values: V) => T | Promise<T>) | T

/**
 * 字段路径类型
 *
 * 支持字符串路径（如 `'user.address.city'`）和类型安全的深层路径推断。
 *
 * @typeParam T - 表单值类型，用于路径类型推断
 */
export type NamePath<T = Values> = DeepNamePath<T>

/**
 * 验证规则触发时机
 *
 * 支持两种命名风格：`onBlur` / `blur`，内部会归一化处理。
 */
export type ValidationTrigger =
  | "onBlur"
  | "onChange"
  | "onSubmit"
  | "blur"
  | "change"
  | "submit"

export type SchemxDefaultContext = {
  /**
   * 校验触发时机
   */
  validationTrigger?: ValidationTrigger | ValidationTrigger[]
  /**
   * 全局 readonly 默认值。
   */
  readonly?: boolean
  /**
   * 全局 disabled 默认值。
   */
  disabled?: boolean
}

/**
 * schemx 组件 Props
 *
 * @typeParam T - 表单值类型
 */
export interface SchemxProps<T extends Values = Values> {
  /** 表单数据（v-model） */
  modelValue?: T
  /** 初始值 */
  initialValues?: T
  /** 表单字段配置 */
  schemas: SchemxField<T>[]
  /** 表单实例 */
  form?: SchemxInstance<T>

  /** 渲染器注册实例 */
  rendererRegistry?: RendererRegistry
  /** 默认渲染器类型，当字段未指定 renderer 时使用 */
  defaultRendererType?: SchemxRendererKey
  /** 规则注册实例 */
  rulesRegistry?: RulesRegistry

  /** 验证触发时机 */
  validationTrigger?: ValidationTrigger | ValidationTrigger[]
  /** 标签图标 */
  labelIcon?: string
  /** 表单 label 排列方向 */
  labelAlign?: "left" | "center" | "right"
  /** 表单 label 位置 */
  labelPosition?: "left" | "top" | "right"
  /** 表单 label 宽度 */
  labelWidth?: string
  /** 表单内容排列方向 */
  contentAlign?: "left" | "center" | "right"
  /** 是否在 label 后面添加冒号 */
  colon?: boolean
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean

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
 * 表单实例接口
 *
 * 定义表单的所有操作方法，是 useForm 返回值的基础接口。
 * SchemxInstance 类实现此接口，提供完整的表单操作能力。
 *
 * @typeParam T - 表单值类型，默认为 Values
 */
export interface SchemxInstance<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TValue = PathValue<TValues, TName>,
> {
  /**
   * 获取单个字段的当前值
   *
   * 返回响应式只读引用，在 computed/watch 中使用时自动追踪变化。
   *
   * @param name - 字段路径
   * @returns 字段当前值（只读）
   *
   * @example
   * ```typescript
   * const name = form.getFieldValue('name')
   * const city = form.getFieldValue('user.address.city')
   * ```
   */
  getFieldValue: (name: TName) => TValue | undefined

  /**
   * 获取多个字段值
   *
   * 不传参数返回所有值（Readonly 只读引用），传入路径数组返回指定字段的值。
   *
   * @param names - 可选，要获取的字段路径数组
   * @returns 全量只读值或指定字段的值
   *
   * @example
   * ```typescript
   * const latestValues = form.getFieldsValue()       // Readonly<T>
   * const partial = form.getFieldsValue(['name', 'email'])
   * ```
   */
  getFieldsValue: {
    (): TValues
    (names: TName[]): TValues
    (names?: TName[]): Partial<TValues>
  }

  /**
   * 设置单个字段值并通知订阅者
   *
   * 支持嵌套路径，如 'user.address.city'。
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
  setFieldValue: (name: TName, value: TValue) => void

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
  setFieldsValue: (values: Partial<TValues>) => void

  /**
   * 获取单个字段值的快照
   *
   * 返回深拷贝的值，不收集依赖，适用于需要脱离响应式的场景。
   *
   * @param name - 字段路径
   * @returns 该字段当前值的深拷贝
   *
   * @example
   * ```typescript
   * const name = form.getFieldSnapshot('name') // => 'John'（深拷贝）
   * ```
   */
  getFieldSnapshot: (name: TName) => TValue | undefined

  /**
   * 获取当前表单值的快照
   *
   * 返回解除 reactive 代理后的原始对象，适用于序列化、提交等场景。
   *
   * @returns 当前表单值的原始对象
   * @see https://vuejs.org/api/reactivity-advanced.html#toraw
   *
   * @example
   * ```typescript
   * const snapshot = form.getFieldsSnapshot()
   * JSON.stringify(snapshot)
   * ```
   */
  getFieldsSnapshot: {
    (): TValues
    (paths: TName[]): TValues
    (paths?: TName[]): Partial<TValues>
  }

  /**
   * 获取表单字段初始值。
   *
   * 不传参返回全量初始值的深拷贝，传入路径返回指定字段的初始值。
   *
   * @param path - 字段路径
   * @returns 全量初始值或指定字段的初始值
   *
   * @example
   * ```typescript
   * form.getInitialValue('name') // => 'John'
   * ```
   */
  getInitialValue: (name: TName) => TValue | undefined

  /**
   * 获取表单初始值。
   *
   * 不传参返回全量初始值的深拷贝，传入路径返回指定字段的初始值。
   *
   * @param path - 可选，字段路径
   * @returns 全量初始值或指定字段的初始值
   *
   * @example
   * ```typescript
   * form.getInitialValues()         // => { name: 'John', age: 25 }
   * form.getInitialValues(['name']) // => { name: 'John' }
   * ```
   */
  getInitialValues: {
    (): Partial<TValues>
    (paths: TName[]): Partial<TValues>
    (paths?: TName[]): Partial<TValues>
  }

  /**
   * 批量设置多个字段的初始值。
   *
   * @param values - 要设置的字段值对象
   *
   * @example
   * ```typescript
   * form.setInitialValues({ name: 'Bob', age: 30 })
   * ```
   */
  setInitialValues: (values: Partial<TValues>) => void

  /**
   * 检查单个字段是否被修改
   *
   * 通过深比较当前值与初始值判断。
   *
   * @param name - 字段路径
   * @returns 是否与初始值不同
   *
   * @example
   * ```typescript
   * form.isFieldTouched('name') // => true
   * ```
   */
  isFieldTouched: (name: TName) => boolean

  /**
   * 设置个字段被修改
   *
   * 传入路径设置字段修改状态。
   *
   * @param name - 字段路径
   * @param value - 值
   *
   * @example
   * ```typescript
   * form.setFieldTouched('name', false)
   * ```
   */
  setFieldTouched: (name: TName, value: boolean) => void

  /**
   * 获取所有被修改的字段路径
   *
   * @returns 被修改的字段路径数组
   *
   * @example
   * ```typescript
   * const touched = form.getTouchedFields()
   * // => ['name', 'user.address.city']
   * ```
   */
  getTouchedFields: () => TName[]

  /**
   * 设置字段的操作中状态
   *
   * 用于标记字段正在进行异步操作（如文件上传），
   * 校验和提交时会检查是否有字段处于操作中状态。
   *
   * @param name - 字段路径
   * @param pending - 是否处于操作中
   * @example
   * ```typescript
   * form.setFieldPending('avatar', true)   // 上传开始
   * form.setFieldPending('avatar', false)  // 上传结束
   * ```
   */
  setFieldPending: (name: TName, pending: boolean) => void

  /**
   * 检查单个字段是否处于操作中
   *
   * 返回响应式值，在 effect 中使用时自动追踪变化。
   *
   * @param name - 字段路径
   * @returns 是否处于操作中
   *
   * @example
   * ```typescript
   * form.isFieldPending('avatar') // => true
   * ```
   */
  isFieldPending: (name: TName) => boolean

  /**
   * 获取所有处于操作中的字段信息
   *
   * 返回当前所有 pending 状态为 true 的字段路径，无操作中字段时返回空数组。
   *
   * @returns 操作中的字段信息数组，每项包含 field（路径）
   *
   * @example
   * ```typescript
   * form.getPendingFields()
   * // => [{ field: 'avatar' }, { field: 'attachment' }]
   * ```
   */
  getPendingFields: () => StorePending<TValues, TName>[]

  /**
   * 重置指定字段到初始值
   *
   * @param names - 要重置的字段路径数组
   *
   * @example
   * ```typescript
   * form.resetFields(['name', 'email'])
   * ```
   */
  resetFields: (names: TName[]) => void

  /**
   * 重置整个表单到初始值
   *
   * 恢复所有字段到构造时的初始值，并通知订阅者。
   *
   * @example
   * ```typescript
   * form.reset()
   * ```
   */
  reset: () => void

  /**
   * 校验指定字段
   *
   * @param names - 字段路径或路径数组
   * @returns 校验结果，成功返回 values，失败返回 errors
   *
   * @example
   * ```typescript
   * const result = await form.validateField('email', formValues)
   * const result = await form.validateField(['name', 'email'], formValues)
   *
   * if (!result.ok) {
   *   console.log(result.error.errors)
   * }
   * ```
   */
  validateField: (names: TName | TName[]) => Promise<ValidateResult<TValues>>

  /**
   * 校验所有已注册字段
   *
   * @returns 校验结果，成功返回 values，失败返回 errors
   *
   * @example
   * ```typescript
   * const result = await form.validate()
   * if (result.ok) {
   *   submitToServer(result.values)
   * }
   * ```
   */
  validate: () => Promise<ValidateResult<TValues>>

  /**
   * 获取单个字段的错误信息
   *
   * @param name - 字段路径
   * @returns 错误信息数组，无错误时返回 undefined
   *
   * @example
   * ```typescript
   * const errors = form.getFieldError('email')
   * // => ['邮箱格式错误'] 或 undefined
   * ```
   */
  getFieldError: (name: TName) => string[] | undefined

  /**
   * 手动设置字段的错误信息
   *
   * @param name - 字段路径
   * @param errors - 错误信息数组
   *
   * @example
   * ```typescript
   * form.setFieldError('username', ['用户名已存在'])
   * ```
   */
  setFieldError: (name: TName, errors: string[]) => void

  /**
   * 提交表单
   *
   * 先校验所有字段，通过后调用 onFinish，失败调用 onFinishFailed。
   * 内置防重复提交锁，提交进行中重复调用返回同一个 Promise。
   *
   * @example
   * ```typescript
   * await form.submit()
   * ```
   */
  submit: () => Promise<void>

  /**
   * 创建 reactive effect 监听字段或错误变化。
   *
   * 回调内调用 getFieldValue/getFieldError 时自动追踪依赖，
   * 当依赖的 reactive value 变化时 effect 自动重新执行。
   *
   * @param fn - effect 回调函数
   * @returns 取消 effect 的函数
   *
   * @example
   * ```typescript
   * const dispose = form.effect(() => {
   *   console.log('name:', form.getFieldValue('name'))
   * })
   * // 当 name 字段变化时 effect 自动重新执行
   * dispose() // 取消 effect
   * ```
   */
  effect: (fn: () => void) => () => void

  /**
   * 批量更新字段值，多次 set 合并为一次 effect 触发。
   *
   * @param fn - 批量操作函数
   *
   * @example
   * ```typescript
   * form.batch(() => {
   *   form.setFieldValue('name', 'Bob')
   *   form.setFieldValue('age', 30)
   * })
   * // 依赖 name 或 age 的 effect 只触发一次
   * ```
   */
  batch: (fn: () => void) => void

  /**
   * 获取当前 ViewTree。
   */
  getViewTree: () => readonly ViewNode[]

  /**
   * 订阅 ViewTree 结构变化。
   */
  subscribeViewTree: (callback: (tree: readonly ViewNode[]) => void) => () => void

  /**
   * 获取 ViewTree 结构版本。
   */
  getViewRevision: () => number

  /**
   * 等待所有异步依赖解析完成
   *
   * @param timeout - 最大等待时间（毫秒），默认 10000
   * @returns true 表示全部完成，false 表示超时
   */
  waitForDependencies: (timeout?: number) => Promise<boolean>

  /**
   * 获取指定类型的渲染器组件
   *
   * 根据类型标识从内部的 RendererRegistry 中查找对应的渲染器组件。
   * 未找到时回退到默认类型，均不存在则返回 undefined。
   *
   * @param type - 渲染器类型标识
   * @returns 对应的渲染器组件，未找到时返回 undefined
   *
   * @example
   * ```typescript
   * const renderer = form.getInternalHooks().getRenderer('input')
   * if (renderer) {
   *   // 使用渲染器组件
   * }
   * ```
   */
  getRenderer: (type: SchemxRendererKey) => unknown | undefined

  /**
   * 注册渲染器组件
   *
   * 将渲染器组件注册到内部的 RendererRegistry，
   * 后续可通过 getRenderer 获取。
   *
   * @param type - 渲染器类型标识
   * @param renderer - 渲染器组件
   *
   * @example
   * ```typescript
   * form.getInternalHooks().registerRenderer('input', InputComponent)
   * ```
   */
  registerRenderer: (type: SchemxRendererKey, renderer: unknown) => void

  /**
   * 检查指定类型的渲染器是否已注册
   *
   * @param type - 渲染器类型标识
   * @returns 是否已注册
   *
   * @example
   * ```typescript
   * if (form.getInternalHooks().hasRenderer('input')) {
   *   // 渲染器已注册
   * }
   * ```
   */
  hasRenderer: (type: SchemxRendererKey) => boolean

  /**
   * 获取指定名称的校验规则条目
   *
   * 从内部 RulesRegistry 查找，支持父级链式查找。
   * 返回原始注册条目（StandardSchemaV1 实例或工厂函数），不做解析。
   *
   * @param name - 规则名称
   * @returns 对应的 RuleEntry，未找到时返回 undefined
   *
   * @example
   * ```typescript
   * const entry = form.getInternalHooks().getRule('phone')
   * ```
   */
  getRule: (name: string) => RuleEntry<TValues> | undefined

  /**
   * 注册校验规则
   *
   * 将校验规则注册到内部的 RulesRegistry，
   * 后续可通过 getRule / hasRule 查询。
   *
   * @param name - 规则名称
   * @param rule - StandardSchemaV1 实例或工厂函数
   *
   * @example
   * ```typescript
   * form.getInternalHooks().registerRule('phone', phoneRule)
   * ```
   */
  registerRule: (name: string, rule: RuleEntry<TValues>) => void

  /**
   * 检查指定名称的校验规则是否已注册
   *
   * 支持父级链式查找。
   *
   * @param name - 规则名称
   * @returns 是否已注册
   *
   * @example
   * ```typescript
   * form.getInternalHooks().hasRule('phone') // => true
   * ```
   */
  hasRule: (name: string) => boolean

  /**
   * 注册字段校验规则
   *
   * @param name - 字段路径
   * @param rules - SchemxRules 校验规则
   * @param defaultMessage - 可选，空值时的默认错误提示
   *
   * @example
   * ```typescript
   * import { z } from 'zod'
   * form.registerRules('email', z.string().email('邮箱格式错误'))
   * form.registerRules('name', nameSchema, '请输入姓名')
   * ```
   */
  registerRules: (
    name: TName,
    rules: SchemxRules | SchemxRules[],
    defaultMessage?: string
  ) => void

  /**
   * 注销字段校验规则
   *
   * 同时清除该字段的错误信息。
   *
   * @param name - 字段路径
   *
   * @example
   * ```typescript
   * form.unregisterRules('email')
   * ```
   */
  unregisterRules: (name: TName) => void

  /**
   * 销毁表单实例
   *
   * 清除所有订阅回调，释放资源。通常在组件卸载时调用。
   *
   * @example
   * ```typescript
   * form.destroy()
   * ```
   */
  destroy: () => void
}

/**
 * 全局状态配置
 *
 * 从 SchemxProps 中提取的全局只读/禁用/触发时机配置。
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SchemxGlobalContext extends Pick<
  SchemxProps,
  "readonly" | "disabled" | "validationTrigger"
> {}

/**
 * 表单 API，提供与表单交互的方法。
 *
 * 传递给动态渲染器，允许程序化操作表单。
 *
 * @typeParam TValues - 表单值类型
 */
export interface SchemxFormApi<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TValue = PathValue<TValues, TName>,
> {
  /**
   * 设置字段值。
   *
   * @param name - 字段路径
   * @param value - 新值
   */
  setValue(name: TName, value: unknown): void

  /**
   * 设置多个字段值。
   *
   * @param values - 字段值对象
   */
  setValues(values: Partial<TValues>): void

  /**
   * 获取字段值。
   *
   * @param name - 字段路径
   */
  getValue(name: TName): TValue | undefined

  /**
   * 获取多个字段值。
   *
   * @param name - 字段路径
   */
  getValues(name?: TName[]): Partial<TValues>

  /**
   * 获取当前表单值的快照
   *
   * @param names - 字段路径
   */
  getSnapshots(names?: TName[]): Partial<TValues>

  /**
   * 重置指定字段到初始值
   *
   * @param names - 要重置的字段路径数组
   *
   * @example
   * ```typescript
   * form.resetFields(['name', 'email'])
   * ```
   */
  resetFields: (names: TName[]) => void

  /**
   * 重置整个表单到初始值
   *
   * 恢复所有字段到构造时的初始值，并通知订阅者。
   */
  reset: () => void

  /**
   * 设置字段的操作中状态
   *
   * 用于标记字段正在进行异步操作（如文件上传），
   * 校验和提交时会检查是否有字段处于操作中状态。
   *
   * @param name - 字段路径
   * @param pending - 是否处于操作中
   */
  setPending: (name: TName, pending: boolean) => void

  /**
   * 检查单个字段是否处于操作中
   *
   * 返回响应式值，在 effect 中使用时自动追踪变化。
   *
   * @param name - 字段路径
   * @returns 是否处于操作中
   *
   */
  isPending: (name: TName) => boolean

  /**
   * 设置字段是否已被触摸。
   *
   * @param name - 字段路径
   * @param value - 值
   */
  setTouched(name: TName, value: boolean): void

  /**
   * 检查字段是否已被触摸。
   *
   * @param name - 字段路径
   * @returns 是否已被触摸
   */
  isTouched(name: TName): boolean

  /**
   * 校验单个字段。
   *
   * @param name - 字段路径
   * @returns 校验结果
   */
  validateField(name: TName): Promise<ValidateResult<TValues>>

  /**
   * 校验所有字段。
   *
   * @returns 校验结果
   */
  validate(): Promise<ValidateResult<TValues>>

  /**
   * 设置字段是否有错误。
   *
   * @param name - 字段路径
   * @param errors - 错误信息数组
   */
  setError(name: TName, errors: string[]): void

  /**
   * 获取字段错误列表。
   *
   * @param name - 字段路径
   * @returns 错误消息数组
   */
  getError(name: TName): string[] | undefined
}
