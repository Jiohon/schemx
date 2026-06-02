/**
 * 输入渲染器类型定义
 *
 * @module renderers/InputRenderer/types
 */

import type { SchemxBaseComponentProps } from "@schemx/vue"

export type InputValue = string | number

/**
 * 输入渲染器 Props
 *
 * 定义输入组件的所有可配置属性。
 */
export interface InputRendererProps
  extends Omit<SchemxBaseComponentProps, "onChange" | "onBlur" | "value" | "onUpdate:value"> {
  /** 当前值 */
  value?: InputValue
  /** 值变化回调 */
  onChange?: (value: string) => void
  /** 失焦回调 */
  onBlur?: (event: FocusEvent) => void
  /** 聚焦回调 */
  onFocus?: (event: FocusEvent) => void
  /** 输入类型 */
  type?: "text" | "textarea" | "number" | "password" | "digit"
  /** 是否只读 */
  readonly?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 是否自动聚焦 */
  autofocus?: boolean
  /** 最大输入长度 */
  maxlength?: number | string
  /** 最小值（数字类型） */
  min?: number
  /** 最大值（数字类型） */
  max?: number
  /** 文本域默认行数 */
  rows?: number | string
  /** 文本域自适应高度配置 */
  autosize?: boolean | { minRows?: number; maxRows?: number }
  /** 自定义格式化函数 */
  formatter?: (value: string) => string
  /** 格式化触发时机 */
  formatTrigger?: "onChange" | "onBlur"
  /** 是否可清除 */
  clearable?: boolean
  /** 清除图标名称 */
  clearIcon?: string
  /** 清除按钮触发方式 */
  clearTrigger?: "focus" | "always"
  /** 左侧图标名称 */
  leftIcon?: string
  /** 右侧图标名称 */
  rightIcon?: string
  /** 是否显示字数统计 */
  showWordLimit?: boolean
  /** 自定义 CSS 类名 */
  className?: string
  /** 只读时的占位文本 */
  readonlyPlaceholder?: string
  /** 自动完成属性 */
  autocomplete?: string
  /** 自动大写属性 */
  autocapitalize?: string
  /** 自动纠正属性 */
  autocorrect?: string
  /** 回车键类型提示 */
  enterkeyhint?: "search" | "done" | "enter" | "go" | "next" | "previous" | "send"
  /** 拼写检查 */
  spellcheck?: boolean | null
  /** 输入模式 */
  inputmode?: "text" | "search" | "tel" | "url" | "email" | "none" | "numeric" | "decimal"
  /** 文本对齐方式 */
  align?: "left" | "center" | "right"
}

/**
 * 格式化数字输入
 *
 * @param value - 输入值
 * @param allowDot - 是否允许小数点
 * @param allowMinus - 是否允许负号
 * @returns 格式化后的值
 */
export function formatNumber(value: string, allowDot = true, allowMinus = true): string {
  if (allowDot) {
    value = value.replace(/[^-0-9.]/g, "")
    // 只保留第一个小数点
    const dotIndex = value.indexOf(".")

    if (dotIndex !== -1) {
      value = value.slice(0, dotIndex + 1) + value.slice(dotIndex + 1).replace(/\./g, "")
    }
  } else {
    value = value.replace(/[^-0-9]/g, "")
  }

  if (allowMinus) {
    // 负号只能在开头
    const minusIndex = value.indexOf("-")

    if (minusIndex > 0) {
      value = value.replace(/-/g, "")
    } else if (minusIndex === 0) {
      value = "-" + value.slice(1).replace(/-/g, "")
    }
  } else {
    value = value.replace(/-/g, "")
  }

  return value
}

/**
 * 获取字符串长度（考虑 emoji 等特殊字符）
 *
 * @param str - 字符串
 * @returns 字符串长度
 */
export function getStringLength(str: string): number {
  return [...String(str)].length
}

/**
 * 截取字符串
 *
 * @param str - 字符串
 * @param maxLength - 最大长度
 * @returns 截取后的字符串
 */
export function cutString(str: string, maxLength: number): string {
  return [...String(str)].slice(0, maxLength).join("")
}
