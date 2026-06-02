/**
 * 选择渲染器类型定义
 *
 * @module renderers/PickerRenderer/types
 */

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type PickerValue = any[] | string | number

/**
 * 选择渲染器字段名配置
 *
 * 自定义选项数据中各字段对应的键名。
 */
export interface PickerFieldNames {
  /** 显示文本字段名 */
  text?: string
  /** 值字段名 */
  value?: string
  /** 子节点字段名 */
  children?: string
}

/**
 * 选择渲染器 Props
 *
 * 定义选择组件的所有可配置属性。
 */
export interface PickerRendererProps
  extends Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value"> {
  /** 当前值 */
  value?: PickerValue
  /** 确认回调，用户点击确定按钮时触发 */
  onConfirm?: (value: any, values: any) => void
  /** 值变化回调，选中项变化时触发 */
  onChange?: (value: any, values: any) => void
  /** 自定义 CSS 类名 */
  className?: string
  /** 弹窗 CSS 类名 */
  popupClassName?: string
  /** 是否返回完整路径 */
  emitPath?: boolean
  /** 是否显示所有层级 */
  showAllLevels?: boolean
  /** 分隔符 */
  separator?: string
  /** 是否只读 */
  readonly?: boolean
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 弹窗标题 */
  title?: string
  /** 选项数据 */
  options?: any[]
  /** 字段名配置 */
  fieldNames?: PickerFieldNames
}
