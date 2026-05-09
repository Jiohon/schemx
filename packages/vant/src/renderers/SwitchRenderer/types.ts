/**
 * 开关渲染器类型定义
 *
 * @module renderers/SwitchRenderer/types
 */

/**
 * 开关渲染器 Props
 *
 * 定义开关组件的所有可配置属性。
 */
export interface SwitchRendererProps {
  /** 当前值 */
  value?: boolean | string | number
  /** 值变化回调，支持异步返回值以更新表单字段 */
  onChange?: (
    value: boolean | string | number
  ) => void | Promise<boolean | string | number | void>
  /** 自定义 CSS 类名 */
  className?: string
  /** 激活状态的文本 */
  activeText?: string
  /** 激活状态对应的值 */
  activeValue?: boolean | string | number
  /** 非激活状态对应的值 */
  inactiveValue?: boolean | string | number
  /** 非激活状态的文本 */
  inactiveText?: string
  /** 是否只读 */
  readonly?: boolean
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** FormItem 组件 Props */
  formItemProps?: Record<string, any>
  /** 表单实例，用于异步更新字段值 */
  formInstance?: Record<string, any> | null
  /** 错误信息 */
  error?: string[]
}
