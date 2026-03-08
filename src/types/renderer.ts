/**
 * 渲染器类型体系
 *
 * 定义渲染器的类型注册、Props 映射和上下文接口。
 * 用户可通过声明合并扩展自定义渲染器类型。
 *
 * @module types/renderer
 */

import type { Component } from "vue"

import type { SchemaFormInstance } from "./instance"

/**
 * 自定义渲染器类型扩展接口
 *
 * 用户可以通过声明合并来扩展自定义渲染器类型。
 *
 * @example
 * ```ts
 * // 在项目中创建 schema-form.d.ts
 * declare module '@Jonhn/vschema-form' {
 *   interface CustomRendererTypes {
 *     'my-custom-input': true
 *     'rich-editor': true
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CustomRendererTypes {}

/**
 * 渲染器类型
 *
 * 由 CustomRendererTypes 的键组成，用户通过声明合并扩展。
 */
export type RendererType = keyof CustomRendererTypes

/**
 * 自定义渲染器 Props 映射扩展接口
 *
 * 用户可以通过声明合并来扩展自定义渲染器的 Props 映射。
 *
 * @example
 * ```ts
 * declare module '@Jonhn/vschema-form' {
 *   interface CustomRendererPropsMap {
 *     'rich-editor': RichEditorProps
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CustomRendererPropsMap {}

/**
 * 完整的渲染器 Props 映射
 *
 * 合并内置映射和自定义扩展映射。
 */
export type RendererPropsMap = CustomRendererPropsMap

/** 渲染器组件映射类型 */
export type RendererMap = Record<string, Component>

/**
 * 渲染器上下文接口
 *
 * 传递给自定义渲染器组件的完整上下文，包含属性、状态和操作方法。
 */
export interface RendererContext {
  /** 组件属性 */
  props: Record<string, unknown>
  /** 透传属性 */
  attrs: Record<string, unknown>
  /** 插槽 */
  slots: Record<string, unknown>
  /** 状态 */
  state: {
    readonly: boolean
    disabled: boolean
    error: string[] | undefined
  }
  /** 操作方法 */
  actions: {
    onChange: (value: unknown) => void
    onBlur: () => void
  }
  /** 表单实例 */
  formContext: SchemaFormInstance | undefined
}
