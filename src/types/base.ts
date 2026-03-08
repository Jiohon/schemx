/**
 * 基础类型定义
 *
 * 表单系统中最基础的类型，被其他所有类型模块依赖。
 *
 * @module types/base
 */

import type { DeepNamePath } from "./namePathType"

/**
 * 将对象中所有 DynamicProp 类型解析为其静态值类型
 *
 * @typeParam T - 包含 DynamicProp 属性的对象类型
 */
export type ResolveDynamic<T> = {
  [K in keyof T]: T[K] extends DynamicProp<infer U> ? U : T[K]
}

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
export type NamePath<T = any> = DeepNamePath<T>

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
 * 动态属性类型
 *
 * 支持静态值或函数形式，函数接收当前表单值并返回属性值（支持异步）。
 *
 * @typeParam T - 属性值类型
 *
 * @example
 * ```ts
 * // 静态值
 * const prop: DynamicProp<boolean> = true
 *
 * // 动态函数
 * const prop: DynamicProp<boolean> = (values) => values.age > 18
 * ```
 */
export type DynamicProp<T> = ((values: FormValues) => T | Promise<T>) | T

/** 自定义校验规则快捷方式 */
export type CustomRules = "required"
