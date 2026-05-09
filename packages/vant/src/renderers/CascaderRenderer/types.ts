/**
 * 级联选择器渲染器类型定义
 *
 * @module renderers/CascaderRenderer/types
 */

/**
 * 级联选择器字段名配置
 */
export interface CascaderFieldNames {
  /** 显示文本字段名 */
  text?: string
  /** 值字段名 */
  value?: string
  /** 子节点字段名 */
  children?: string
}

/**
 * 级联选择器渲染器 Props
 *
 * 定义级联选择组件的所有可配置属性。
 */
export interface CascaderRendererProps {
  /** 当前值 */
  value?: any[] | string | number
  /** 确认回调 */
  onConfirm?: (value: any[]) => void
  /** 自定义 CSS 类名 */
  className?: string
  /** 是否显示所有层级 */
  showAllLevels?: boolean
  /** 是否返回完整路径 */
  emitPath?: boolean
  /** 字段名配置 */
  fieldNames?: CascaderFieldNames
  /** 分隔符 */
  separator?: string
  /** 占位提示文本 */
  placeholder?: string
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 值变化回调 */
  onChange?: (value: any[]) => void
  /** 选项数据 */
  options?: any[]
  /** 弹窗标题 */
  title?: string
  /** FormItem 组件 Props */
  formItemProps?: Record<string, any>
  /** 表单实例 */
  formInstance?: Record<string, any> | null
  /** 弹窗 CSS 类名 */
  popupClassName?: string
  /** 错误信息 */
  error?: string[]
}
