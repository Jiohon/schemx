import type { DeepReadonly } from "vue"

import { FormValues, NamePath, Value } from "@/types"

import type {
  FieldsSubscribeCallback,
  FieldSubscribeCallback,
  GlobalSubscribeCallback,
} from "../core/subscriber"
import type { ValidateResult } from "../core/validator"
import type { StandardSchemaV1 } from "../core/standardSchema"

/**
 * 表单实例接口
 *
 * 定义表单的所有操作方法，是 useForm 返回值的基础接口。
 * SchemaFormInstance 类实现此接口，提供完整的表单操作能力。
 *
 * @typeParam T - 表单值类型，默认为 FormValues
 */
export interface SchemaFormInstance<T extends FormValues = FormValues> {
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
  setFieldsValue: (values: DeepReadonly<Partial<T>>) => void

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
  getFieldValue: (name: NamePath<T>) => DeepReadonly<Value>

  /**
   * 获取多个字段值
   *
   * 不传参数返回所有值（DeepReadonly 只读引用），传入路径数组返回指定字段的值。
   *
   * @param names - 可选，要获取的字段路径数组
   * @returns 全量只读值或指定字段的值
   *
   * @example
   * ```typescript
   * const latestValues = form.getFieldsValue()       // DeepReadonly<T>
   * const partial = form.getFieldsValue(['name', 'email'])
   * ```
   */
  getFieldsValue: (names?: NamePath<T>[]) => DeepReadonly<Partial<T>>

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
  getFieldsSnapshot: () => T

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
  getInitialValues: (path?: NamePath<T>[]) => T | Partial<T>

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
   * @param rules - StandardSchemaV1 校验规则
   * @param defaultMessage - 可选，空值时的默认错误提示
   *
   * @example
   * ```typescript
   * import { z } from 'zod'
   * form.registerRule('email', z.string().email('邮箱格式错误'))
   * form.registerRule('name', nameSchema, '请输入姓名')
   * ```
   */
  registerRule: (
    name: NamePath<T>,
    rules: StandardSchemaV1,
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
   * form.unregisterRule('email')
   * ```
   */
  unregisterRule: (name: NamePath<T>) => void

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
  isFieldsTouched: (names?: NamePath<T>) => boolean

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
   * 订阅单个字段变化
   *
   * 当订阅的字段或其父/子路径发生变化时，都会收到通知。
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
  subscribe: (path: NamePath<T>, callback: FieldSubscribeCallback<T>) => () => void

  /**
   * 订阅多个字段变化
   *
   * 当任一指定字段变化时，收集所有订阅字段的当前值快照和上一次快照，传给回调。
   *
   * @param paths - 要订阅的字段路径数组
   * @param callback - 变化时的回调函数，接收 (payload, prevSnapshot, latestSnapshot)
   * @returns 取消所有订阅的函数
   *
   * @example
   * ```typescript
   * const unsubscribe = form.subscribeFields(['name', 'email'], (payload, prevSnapshot, latestSnapshot) => {
   *   console.log('subscribed fields:', payload.changedValues)
   * })
   * unsubscribe()
   * ```
   */
  subscribeFields: (
    paths: NamePath<T>[],
    callback: FieldsSubscribeCallback<T>
  ) => () => void

  /**
   * 订阅所有字段变化
   *
   * 当任何字段值变化时都会收到通知。
   *
   * @param callback - 变化时的回调函数
   * @returns 取消订阅的函数
   *
   * @example
   * ```typescript
   * const unsubscribe = form.subscribeAll((payload, prevSnapshot, latestSnapshot) => {
   *   console.log('Changed:', payload.changedValues)
   * })
   * unsubscribe()
   * ```
   */
  subscribeAll: (callback: GlobalSubscribeCallback<T>) => () => void

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
