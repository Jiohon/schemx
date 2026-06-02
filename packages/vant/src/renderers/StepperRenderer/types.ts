/**
 * 步进器渲染器类型定义
 *
 * @module renderers/StepperRenderer/types
 */

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type StepperValue = number

/**
 * 步进器渲染器 Props
 *
 * 定义步进器组件的所有可配置属性。
 */
export interface StepperRendererProps
  extends Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value"> {
  /** 当前值 */
  value?: StepperValue
  /** 值变化回调 */
  onChange?: (value: StepperValue) => void
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 步长 */
  step?: number
  /** 是否只允许整数 */
  integer?: boolean
  /** 小数位数 */
  decimalLength?: number
  /** 自定义 CSS 类名 */
  className?: string
  /** 是否只读 */
  readonly?: boolean
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否允许空值 */
  allowEmpty?: boolean
}
