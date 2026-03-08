/**
 * 校验触发工具
 *
 * 提供校验触发时机的归一化和匹配判断功能。
 *
 * @module utils/validation
 */

import type { ValidationTrigger } from "../types"

/** 归一化后的触发类型 */
type NormalizedTrigger = "blur" | "change" | "submit"

/**
 * 归一化触发类型字符串
 *
 * 将带 `on` 前缀的格式统一为短格式：
 * `"onBlur"` → `"blur"`, `"onChange"` → `"change"`, `"onSubmit"` → `"submit"`
 *
 * @param t - 原始触发类型
 * @returns 归一化后的触发类型
 */
function normalizeTrigger(t: ValidationTrigger): NormalizedTrigger {
  const map: Record<ValidationTrigger, NormalizedTrigger> = {
    onBlur: "blur",
    onChange: "change",
    onSubmit: "submit",
    blur: "blur",
    change: "change",
    submit: "submit",
  }

  return map[t] ?? "submit"
}

/**
 * 判断当前事件是否应该触发校验
 *
 * 将配置的触发时机归一化后，与当前事件类型进行匹配。
 *
 * @param event - 当前触发的事件类型
 * @param trigger - 配置的触发时机（支持单个或数组）
 * @returns 是否应该触发校验
 *
 * @example
 * ```typescript
 * shouldValidateOn("change", "onChange")              // => true
 * shouldValidateOn("blur", ["onBlur", "onChange"])    // => true
 * shouldValidateOn("change", "onSubmit")              // => false
 * shouldValidateOn("change", undefined)               // => false
 * ```
 */
export function shouldValidateOn(
  event: NormalizedTrigger,
  trigger?: ValidationTrigger | ValidationTrigger[]
): boolean {
  if (!trigger) return false
  const triggers = Array.isArray(trigger) ? trigger : [trigger]

  return triggers.some((t) => normalizeTrigger(t) === event)
}
