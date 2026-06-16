/**
 * 脱敏输入渲染器类型定义
 *
 * @module renderers/SensitiveInputRenderer/types
 */

import type {
  SensitiveInputProps,
  SensitiveInputValue,
} from "@/components/SensitiveInput"

export type { SensitiveInputValue }

export interface SensitiveInputRendererProps
  extends Omit<SensitiveInputProps, "value" | "onChange"> {
  /** 当前真实值 */
  value?: SensitiveInputValue
  /** 值变化回调，始终回传真实值 */
  onChange?: (value: string) => void
}
