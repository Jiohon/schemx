/**
 * 滑块渲染器类型定义
 *
 * @module renderers/SliderRenderer/types
 */

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type SliderValue = number | [number, number]

/**
 * 滑块渲染器 Props
 *
 * 定义滑块组件的所有可配置属性。
 */
export interface SliderRendererProps
  extends Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value"> {
  /** 当前值，支持单值或范围值 */
  value?: SliderValue
  /** 值变化回调 */
  onChange?: (value: SliderValue) => void
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 步长 */
  step?: number
  /** 是否开启范围选择 */
  range?: boolean
  /** 自定义 CSS 类名 */
  className?: string
  /** 是否只读 */
  readonly?: boolean
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否显示按钮 */
  button?: boolean
}
