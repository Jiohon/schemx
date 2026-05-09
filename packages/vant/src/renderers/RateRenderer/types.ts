/**
 * 评分渲染器类型定义
 *
 * @module renderers/RateRenderer/types
 */

/**
 * 评分渲染器 Props
 *
 * 定义评分组件的所有可配置属性。
 */
export interface RateRendererProps {
  /** 当前评分值 */
  value?: number
  /** 星星总数 */
  count?: number
  /** 是否允许半星 */
  allowHalf?: boolean
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
  /** 错误信息 */
  error?: string[]
}
