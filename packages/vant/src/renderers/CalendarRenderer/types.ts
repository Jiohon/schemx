/**
 * 日历选择器渲染器类型定义
 *
 * @module renderers/CalendarRenderer/types
 */

import { SchemxFormItemProps, SchemxInstance } from "@schemx/vue"

/**
 * 日历选择器渲染器 Props
 *
 * 定义日历选择组件的所有可配置属性。
 */
export interface CalendarRendererProps {
  /** 当前值，支持字符串、字符串数组或 Date 对象 */
  value?: string | string[] | Date
  /** 确认回调 */
  onConfirm?: (value: string | string[]) => void
  /** 自定义 CSS 类名 */
  className?: string
  /** 弹窗 CSS 类名 */
  popupClassName?: string
  /** 占位文本 */
  placeholder?: string
  /** 值变化回调 */
  onChange?: (value: string | string[]) => void
  /** 是否只读 */
  readonly?: boolean
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 日历类型：单选、范围选择、多选 */
  type?: "single" | "range" | "multiple"
  /** 日期格式化字符串 */
  format?: string
  /** 范围选择时的分隔符 */
  separator?: string
  /** FormItem 组件 Props */
  formItemProps?: SchemxFormItemProps
  /** 表单实例 */
  formInstance?: SchemxInstance
  /** 错误信息 */
  error?: string[]
}
