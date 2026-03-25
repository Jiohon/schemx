/**
 * validation 校验触发工具单元测试
 *
 * 覆盖 mergeTrigger 优先级合并和 shouldValidateOn 事件匹配。
 *
 * @module utils/__tests__/validation
 */
import { describe, expect, it } from "vitest"

import { mergeTrigger, shouldValidateOn } from "../validation"

describe("mergeTrigger", () => {
  it("schemaTrigger 有效时返回 schemaTrigger（最高优先级）", () => {
    expect(mergeTrigger("onBlur", "onChange", "onSubmit")).toBe("onBlur")
  })

  it("schemaTrigger 为 undefined 时返回 contextTrigger（第二优先级）", () => {
    expect(mergeTrigger(undefined, "onChange", "onSubmit")).toBe("onChange")
  })

  it("schemaTrigger 为空数组时跳过，使用 contextTrigger", () => {
    expect(mergeTrigger([], "onChange", "onSubmit")).toBe("onChange")
  })

  it("schemaTrigger 和 contextTrigger 均为 undefined 时返回 defaultTrigger", () => {
    expect(mergeTrigger(undefined, undefined, "onSubmit")).toBe("onSubmit")
  })

  it("schemaTrigger 和 contextTrigger 均为空数组时返回 defaultTrigger", () => {
    expect(mergeTrigger([], [], "onSubmit")).toBe("onSubmit")
  })
})

describe("shouldValidateOn", () => {
  it("匹配的事件返回 true", () => {
    expect(shouldValidateOn("change", "onChange")).toBe(true)
    expect(shouldValidateOn("blur", "onBlur")).toBe(true)
    expect(shouldValidateOn("submit", "onSubmit")).toBe(true)
  })

  it("不匹配的事件返回 false", () => {
    expect(shouldValidateOn("change", "onSubmit")).toBe(false)
    expect(shouldValidateOn("blur", "onChange")).toBe(false)
  })

  it("数组触发配置中任一匹配即返回 true", () => {
    expect(shouldValidateOn("blur", ["onBlur", "onChange"])).toBe(true)
    expect(shouldValidateOn("change", ["onBlur", "onChange"])).toBe(true)
  })

  it("undefined 触发配置返回 false", () => {
    expect(shouldValidateOn("change", undefined)).toBe(false)
  })

  it("带 on 前缀的触发类型归一化后正确匹配", () => {
    expect(shouldValidateOn("blur", "onBlur")).toBe(true)
    expect(shouldValidateOn("change", "change")).toBe(true)
    expect(shouldValidateOn("submit", "submit")).toBe(true)
  })
})
