/**
 * 基础类型定义
 *
 * 表单系统中最基础的类型，被其他所有类型模块依赖。
 *
 * @module types/base
 */

import type { DeepNamePath } from "./namePathType"

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

/** 自定义校验规则快捷方式 */
export type CustomRules = "required"
