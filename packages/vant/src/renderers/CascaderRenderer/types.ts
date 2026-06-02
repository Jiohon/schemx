/**
 * 级联选择器渲染器类型定义
 *
 * @module renderers/CascaderRenderer/types
 */

import type { SchemxBaseComponentProps } from "@schemx/vue"
import type { CascaderOption, PopupProps } from "vant"

export type CascaderValue = (string | number)[]

/**
 * 级联选择器字段名配置
 *
 * 自定义选项数据中各字段对应的键名。
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
export interface CascaderRendererProps
  extends Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value"> {
  /** 当前值 */
  value?: CascaderValue
  /** 确认回调，用户选择完成时触发 */
  onConfirm?: (value: CascaderValue) => void
  /** 值变化回调，选中项变化时触发 */
  onChange?: (value: CascaderValue) => void
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
  /** 是否只读 */
  readonly?: boolean
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 选项数据 */
  options?: CascaderOption[]
  /** 弹窗标题 */
  title?: string
  /**
   * Popup 组件 Props 与事件透传
   *
   * 默认值：{ round: true, position: "bottom", safeAreaInsetBottom: true, teleport: "body" }
   *
   * 通过此属性可覆盖默认 Popup 配置或传入额外事件回调，
   * 避免组件顶层 Props 与 Popup 原生属性产生命名冲突。
   *
   * @example
   * ```ts
   * popupProps={{
   *   round: false,
   *   zIndex: 2000,
   *   closeOnClickOverlay: false,
   *   onOpened: () => console.log('popup opened'),
   *   onClickOverlay: () => console.log('overlay clicked'),
   * }}
   * ```
   */
  popupProps?: Partial<Omit<PopupProps, "show">>
  /** 弹窗 CSS 类名 */
  popupClassName?: string
  /**
   * 关闭回调
   *
   * 用户点击遮罩层或 Cascader 关闭按钮时触发，
   * 区别于 onConfirm（仅在选择完成时触发）。
   */
  onClose?: () => void
}
