/**
 * 步进器渲染器类型定义
 *
 * @module renderers/StepperRenderer/types
 */

/**
 * 步进器渲染器 Props
 *
 * 定义步进器组件的所有可配置属性。
 */
export interface StepperRendererProps {
  /** 当前值 */
  value?: number
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
  /** FormItem 组件 Props */
  formItemProps?: Record<string, any>
  /** 表单实例 */
  formInstance?: Record<string, any> | null
  /** 值变化回调 */
  onChange?: (value: number) => void
  /** 是否只读 */
  readonly?: boolean
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否允许空值 */
  allowEmpty?: boolean
  /** 错误信息 */
  error?: string[]
}
