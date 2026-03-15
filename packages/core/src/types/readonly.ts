/**
 * 框架无关的工具类型定义
 *
 * 提供 DeepReadonly 和 CSSProperties 等工具类型，
 * 替代 Vue 框架中的同名类型，使核心包不依赖任何 UI 框架的类型系统。
 *
 * @module types/utils
 */

import type * as CSS from "csstype"

/**
 * 递归只读工具类型
 *
 * 将对象及其所有嵌套属性标记为只读，功能等价于 Vue 的 `DeepReadonly`。
 * 支持数组、普通对象和原始类型的递归处理。
 *
 * @typeParam T - 需要转换为深层只读的目标类型
 *
 * @example
 * interface User {
 *   name: string
 *   address: { city: string }
 *   tags: string[]
 * }
 *
 * type ReadonlyUser = DeepReadonly<User>
 * // { readonly name: string; readonly address: { readonly city: string }; readonly tags: ReadonlyArray<string> }
 */
export type DeepReadonly<T> = T extends (infer U)[]
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T

/**
 * CSS 样式属性类型
 *
 * 基于 csstype 的完整 CSS 属性定义，提供类型安全的样式声明。
 *
 * @example
 * const style: CSSProperties = {
 *   color: 'red',
 *   fontSize: '14px',
 *   lineHeight: 1.5,
 * }
 */
export type CSSProperties = CSS.Properties
