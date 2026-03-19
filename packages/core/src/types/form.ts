/**
 * 表单组件 Props 类型
 *
 * 定义 schemx 组件及 FormItem 组件的 Props 接口。
 *
 * @module types/form
 */

import * as CSS from "csstype"

import { DeepNamePath } from "./namePathType"
import { Rules } from "./rule"

import type { DeepReadonly } from "./readonly"
import type { SchemaField } from "./schema"
import type { RendererRegistry } from "../rendererRegistry"
import type { ValidateResult } from "../validator"
import type { ValidateError } from "../validator"

/** 字段值类型 */
export type Value = any

/** 表单值类型，键值对结构 */
export type FormValues = Record<string, Value>

/**
 * 字段路径类型
 *
 * 支持字符串路径（如 `'user.address.city'`）和类型安全的深层路径推断。
 *
 * @typeParam T - 表单值类型，用于路径类型推断
 */
export type NamePath<T = FormValues> = DeepNamePath<T>

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

/**
 * schemx 组件 Props
 *
 * @typeParam T - 表单值类型
 */
export interface SchemxProps<T extends FormValues = FormValues> {
  /** 表单数据（v-model） */
  modelValue?: T
  /** 初始值 */
  initialValues?: T
  /** 表单字段配置 */
  schemas: SchemaField[]
  /** 表单实例 */
  form?: SchemxInstance
  /** 渲染器注册实例 */
  rendererRegistry?: RendererRegistry
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
  /** 自定义类名 */
  className?: string
  /** 自定义样式 */
  style?: CSS.Properties
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
  /** 全局 HTTP 请求器，作为该表单实例内所有 useDictOptions 的默认请求器 */
  request?: (url: string) => Promise<any>
}

/**
 * 表单实例接口
 *
 * 定义表单的所有操作方法，是 useForm 返回值的基础接口。
 * SchemxInstance 类实现此接口，提供完整的表单操作能力。
 *
 * @typeParam T - 表单值类型，默认为 FormValues
 */
export interface SchemxInstance<T extends FormValues = FormValues> {
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
  setFieldValue: (name: NamePath<T>, value: Value) => void

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
  setFieldsValue: (values: Readonly<Partial<T>>) => void

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
  getFieldValue: (name: NamePath<T>) => Readonly<Value>

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
  getFieldSnapshot: (name: NamePath<T>) => Value

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
    (): Readonly<T>
    (names: NamePath<T>[]): Readonly<Partial<T>>
  }

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
    (): T
    (paths: NamePath<T>[]): Partial<T>
  }

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
    (): T
    (paths: NamePath<T>[]): Partial<T>
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
  setInitialValues: (values: Partial<T>) => void

  /**
   * 注册字段校验规则
   *
   * @param name - 字段路径
   * @param rules - Rules 校验规则
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
    name: NamePath<T>,
    rules: Rules | Rules[],
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
  unregisterRules: (name: NamePath<T>) => void

  /**
   * 校验指定字段
   *
   * @param names - 字段路径或路径数组
   * @returns 校验结果，成功返回 values，失败返回 errors
   *
   * @example
   * ```typescript
   * const result = await form.validateField('email')
   * const result = await form.validateField(['name', 'email'])
   * if (!result.ok) {
   *   console.log(result.error.errors)
   * }
   * ```
   */
  validateField: (names: NamePath | NamePath<T>[]) => Promise<ValidateResult<T>>

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
  validate: () => Promise<ValidateResult<T>>

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
  getFieldError: (name: NamePath<T>) => string[] | undefined

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
  setFieldError: (name: NamePath<T>, errors: string[]) => void

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
   * 重置指定字段到初始值
   *
   * @param names - 要重置的字段路径数组
   *
   * @example
   * ```typescript
   * form.resetFields(['name', 'email'])
   * ```
   */
  resetFields: (names: NamePath<T>[]) => void

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
  isFieldTouched: (name: NamePath<T>) => boolean

  /**
   * 检查多个字段是否被修改
   *
   * 传入路径数组时检查所有指定字段是否都被修改，不传则检查是否有任一字段被修改。
   *
   * @param names - 可选，要检查的字段路径
   * @returns 是否被修改
   *
   * @example
   * ```typescript
   * form.isFieldsTouched(['name', 'email']) // 所有字段都被修改才返回 true
   * form.isFieldsTouched()                  // 任一字段被修改即返回 true
   * ```
   */
  isFieldsTouched: (names?: NamePath<T>[]) => boolean

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
  getTouchedFields: () => string[]

  /**
   * 创建 Signal effect 监听字段或错误变化。
   *
   * 回调内调用 getFieldValue/getFieldError 时自动追踪依赖，
   * 当依赖的 Signal 变化时 effect 自动重新执行。
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
export interface GlobalContext extends Pick<
  SchemxProps,
  "readonly" | "disabled" | "validationTrigger"
> {}
