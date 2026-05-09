/**
 * 日期选择渲染器类型定义
 *
 * @module renderers/DateRenderer/types
 */

/**
 * 日期选择渲染器 Props
 *
 * 定义日期选择组件的所有可配置属性。
 */
export interface DateRendererProps {
  /** 当前值，支持字符串、字符串数组或 Date 对象 */
  value?: string | string[] | Date
  /** 确认回调 */
  onConfirm?: (value: string) => void
  /** 日期格式化字符串或格式化函数 */
  format?: string | ((value: any) => string)
  /** 自定义 CSS 类名 */
  className?: string
  /** 弹窗 CSS 类名 */
  popupClassName?: string
  /** FormItem 组件 Props */
  formItemProps?: Record<string, any>
  /** 表单实例 */
  formInstance?: Record<string, any> | null
  /** 值变化回调 */
  onChange?: (value: string) => void
  /** 占位提示文本 */
  placeholder?: string
  /** 是否只读 */
  readonly?: boolean
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 错误信息 */
  error?: string[]
}
