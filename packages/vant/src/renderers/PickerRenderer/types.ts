/**
 * 选择渲染器类型定义
 *
 * @module renderers/PickerRenderer/types
 */

/**
 * 选择渲染器字段名配置
 */
export interface PickerFieldNames {
  /** 显示文本字段名 */
  text?: string
  /** 值字段名 */
  value?: string
  /** 子节点字段名 */
  children?: string
}

/**
 * 选择渲染器 Props
 *
 * 定义选择组件的所有可配置属性。
 */
export interface PickerRendererProps {
  /** 分隔符 */
  separator?: string
  /** 当前值 */
  value?: any[] | string | number
  /** 是否显示所有层级 */
  showAllLevels?: boolean
  /** 是否返回完整路径 */
  emitPath?: boolean
  /** 确认回调 */
  onConfirm?: (value: any, values: any) => void
  /** 自定义 CSS 类名 */
  className?: string
  /** 弹窗 CSS 类名 */
  popupClassName?: string
  /** FormItem 组件 Props */
  formItemProps?: Record<string, any>
  /** 表单实例 */
  formInstance?: Record<string, any> | null
  /** 值变化回调 */
  onChange?: (value: any, values: any) => void
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 弹窗标题 */
  title?: string
  /** 选项数据 */
  options?: any[]
  /** 字段名配置 */
  fieldNames?: PickerFieldNames
  /** 错误信息 */
  error?: string[]
}
