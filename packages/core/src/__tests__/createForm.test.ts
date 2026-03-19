/**
 * CreateFormInstance 属性测试（Property-Based Testing）
 *
 * 使用 fast-check 验证 createFormInstance 工厂函数创建的表单实例的正确性属性。
 * 每个属性测试至少运行 100 次迭代。
 *
 * @module core/__tests__/createForm
 */

import fc from "fast-check"
import { describe, expect, it } from "vitest"

import { createFormInstance } from "../createForm"

describe("CreateFormInstance 属性测试", () => {
  // Feature: pure-signal-core-refactor, Property 10: onValuesChange 回调正确性
  // **Validates: Requirements 8.7, 8.8**
  it("Property 10: 对于任意字段路径和值变更，onValuesChange 应接收正确的 changedValues", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1 })
          .filter(
            (s) =>
              !s.includes(".") &&
              s.trim().length > 0 &&
              !["__proto__", "constructor", "prototype"].includes(s)
          ),
        fc.integer(),
        fc.integer(),
        (path, initialValue, newValueRaw) => {
          // 确保 newValue 与 initialValue 不同，否则 signal 不触发 effect
          const newValue = initialValue === newValueRaw ? newValueRaw + 1 : newValueRaw

          // 记录回调接收到的参数
          let receivedChangedValues: any = null
          let receivedLatestSnapshot: any = null

          // 创建配置了 onValuesChange 的表单实例
          const form = createFormInstance({
            initialValues: { [path]: initialValue } as any,
            onValuesChange: (changedValues, latestSnapshot) => {
              receivedChangedValues = changedValues
              receivedLatestSnapshot = latestSnapshot
            },
          })

          // 修改字段值，触发回调
          form.setFieldValue(path, newValue)

          // 验证回调被触发且 changedValues 包含正确的字段和值
          expect(receivedChangedValues).toBeDefined()
          expect((receivedChangedValues as any)[path]).toBe(newValue)

          // 验证 latestSnapshot 包含最新值
          expect(receivedLatestSnapshot).toBeDefined()
          expect((receivedLatestSnapshot as any)[path]).toBe(newValue)

          form.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })
})
