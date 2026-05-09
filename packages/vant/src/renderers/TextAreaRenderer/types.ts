/**
 * 文本域输入渲染器类型定义
 *
 * @module renderers/TextAreaRenderer/types
 */

/**
 * 文本域自适应高度配置
 */
export interface TextAreaAutosize {
  /** 最小行数 */
  minRows?: number
  /** 最大行数 */
  maxRows?: number
}

/**
 * 文本域输入渲染器 Props
 *
 * 定义文本域输入组件的所有可配置属性。
 */
export interface TextAreaRendererProps {
  /** 自定义 CSS 类名 */
  className?: string
  /** 自适应高度配置 */
  autosize?: boolean | TextAreaAutosize
  /** 自适应高度配置（兼容旧属性名） */
  autoSize?: boolean | TextAreaAutosize
  /** 默认行数 */
  rows?: number | string
  /** 最大输入长度 */
  maxlength?: number | string
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
  /** 是否显示字数统计 */
  showWordLimit?: boolean
  /** 错误信息 */
  error?: string[]
}
