/**
 * 数字输入渲染器类型定义
 *
 * @module renderers/NumberRenderer/types
 */

/**
 * 数字输入渲染器 Props
 *
 * 定义数字输入组件的所有可配置属性。
 */
export interface NumberRendererProps {
  /** 自定义 CSS 类名 */
  className?: string
  /** 输入类型，number 支持小数，digit 仅支持整数 */
  type?: "number" | "digit"
  /** FormItem 组件 Props */
  formItemProps?: Record<string, any>
  /** 表单实例 */
  formInstance?: Record<string, any> | null
  /** 占位提示文本 */
  placeholder?: string
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 当前值 */
  value?: string | number
  /** 值变化回调 */
  onChange?: (value: string) => void
  /** 失焦回调 */
  onBlur?: (event: FocusEvent) => void
  /** 聚焦回调 */
  onFocus?: (event: FocusEvent) => void
  /** 文本对齐方式 */
  align?: "left" | "center" | "right"
  /** 是否可清除 */
  clearable?: boolean
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 错误信息 */
  error?: string[]
}
