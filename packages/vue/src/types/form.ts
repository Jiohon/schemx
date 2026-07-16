import type { SchemxProps, Values } from "@schemx/core"
import { StyleValue } from "vue"

/**
 * schemx 组件 Props
 *
 * @typeParam T - 表单值类型
 */
export interface SchemxFormProps<T extends Values = Values> extends SchemxProps<T> {
  /**
   * 自定义 CSS 类名
   */
  class?: string

  /**
   * 自定义内联样式
   */
  style?: StyleValue
}
