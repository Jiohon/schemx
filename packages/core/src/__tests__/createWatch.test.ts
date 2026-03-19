/**
 * createWatch 属性测试（Property-Based Testing）
 *
 * 使用 fast-check 验证 createWatchField / createWatchFields / createWatchAll
 * 的正确性属性。每个属性测试至少运行 100 次迭代。
 *
 * @module core/__tests__/createWatch
 */

import fc from "fast-check"
import { describe, expect, it } from "vitest"

import { createFormInstance } from "../createForm"
import { createWatchAll, createWatchField, createWatchFields } from "../createWatch"

/**
 * 生成合法的字段名（以字母开头，仅包含字母、数字和下划线）
 */
const fieldNameArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => /^[a-zA-Z]\w*$/.test(s))

/**
 * 生成原始类型值，避免 collectObjectPathsByLeaf 将对象/数组展开为嵌套路径
 */
const safeValueArb = fc.oneof(fc.integer(), fc.string(), fc.boolean(), fc.constant(null))

describe("createWatch 属性测试", () => {
  // Feature: pure-signal-core-refactor, Property 11: createWatchField 回调正确性
  // **Validates: Requirements 9.1, 9.2**
  it("Property 11: 对于任意被监听的字段路径，当值从 oldValue 变为 newValue 时，回调应接收 (newValue, oldValue)", () => {
    fc.assert(
      fc.property(
        fieldNameArb,
        safeValueArb,
        safeValueArb,
        (fieldName, initialValue, newValueRaw) => {
          // 确保新旧值不同
          const newValue =
            JSON.stringify(initialValue) === JSON.stringify(newValueRaw)
              ? "___different___"
              : newValueRaw

          const form = createFormInstance({
            initialValues: { [fieldName]: initialValue } as any,
          })

          let receivedCurrent: any = undefined
          let receivedPrev: any = undefined
          let callCount = 0

          createWatchField(
            form,
            fieldName,
            (current, prev) => {
              receivedCurrent = current
              receivedPrev = prev
              callCount++
            },
            {}
          )

          // 修改字段值触发回调
          form.setFieldValue(fieldName, newValue)

          expect(callCount).toBe(1)
          expect(receivedCurrent).toEqual(newValue)
          expect(receivedPrev).toEqual(initialValue)

          form.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pure-signal-core-refactor, Property 12: createWatchFields 回调正确性
  // **Validates: Requirements 9.4, 9.5**
  it("Property 12: 对于任意一组被监听的字段路径，当任一字段值变化时，回调应接收 (currentValues, prevValues)", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fieldNameArb, { minLength: 1, maxLength: 5 }),
        safeValueArb,
        safeValueArb,
        (fieldNames, initialValue, newValueRaw) => {
          // 确保新旧值不同
          const newValue =
            JSON.stringify(initialValue) === JSON.stringify(newValueRaw)
              ? "___different___"
              : newValueRaw

          // 为所有字段设置初始值
          const initialValues: Record<string, any> = {}
          for (const name of fieldNames) {
            initialValues[name] = initialValue
          }

          const form = createFormInstance({
            initialValues: initialValues as any,
          })

          let receivedCurrentValues: Record<string, any> = {}
          let receivedPrevValues: Record<string, any> = {}
          let callCount = 0

          createWatchFields(
            form,
            fieldNames,
            (currentValues, prevValues) => {
              receivedCurrentValues = currentValues
              receivedPrevValues = prevValues
              callCount++
            },
            {}
          )

          // 修改第一个字段的值
          const targetField = fieldNames[0]
          form.setFieldValue(targetField, newValue)

          expect(callCount).toBe(1)

          // currentValues 应包含所有被监听字段的最新值
          expect(receivedCurrentValues[targetField]).toEqual(newValue)

          // 其他字段应保持初始值
          for (const name of fieldNames.slice(1)) {
            expect(receivedCurrentValues[name]).toEqual(initialValue)
          }

          // prevValues 应包含变更前的值
          expect(receivedPrevValues[targetField]).toEqual(initialValue)

          form.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pure-signal-core-refactor, Property 13: createWatchAll 回调正确性
  // **Validates: Requirements 9.7, 9.8**
  it("Property 13: 对于任意字段值变更，createWatchAll 回调应接收包含所有字段最新值的 latestSnapshot", () => {
    fc.assert(
      fc.property(
        fieldNameArb,
        safeValueArb,
        safeValueArb,
        (fieldName, initialValue, newValueRaw) => {
          // 确保新旧值不同
          const newValue =
            JSON.stringify(initialValue) === JSON.stringify(newValueRaw)
              ? "___different___"
              : newValueRaw

          const form = createFormInstance({
            initialValues: { [fieldName]: initialValue } as any,
          })

          let receivedSnapshot: any = undefined
          let callCount = 0

          createWatchAll(
            form,
            (latestSnapshot) => {
              receivedSnapshot = latestSnapshot
              callCount++
            },
            {}
          )

          // 修改字段值触发回调
          form.setFieldValue(fieldName, newValue)

          expect(callCount).toBe(1)
          expect(receivedSnapshot).toBeDefined()
          expect(receivedSnapshot[fieldName]).toEqual(newValue)

          form.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pure-signal-core-refactor, Property 14: immediate 选项触发初始回调
  // **Validates: Requirements 9.10**
  describe("Property 14: immediate 选项触发初始回调", () => {
    it("createWatchField: immediate: true 时应在创建后立即执行一次回调", () => {
      fc.assert(
        fc.property(fieldNameArb, safeValueArb, (fieldName, initialValue) => {
          const form = createFormInstance({
            initialValues: { [fieldName]: initialValue } as any,
          })

          let callCount = 0
          let receivedCurrent: any = undefined

          createWatchField(
            form,
            fieldName,
            (current, _prev) => {
              callCount++
              receivedCurrent = current
            },
            { immediate: true }
          )

          // immediate 应在创建后立即触发一次
          expect(callCount).toBe(1)
          expect(receivedCurrent).toEqual(initialValue)

          form.destroy()
        }),
        { numRuns: 100 }
      )
    })

    it("createWatchFields: immediate: true 时应在创建后立即执行一次回调", () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fieldNameArb, { minLength: 1, maxLength: 5 }),
          safeValueArb,
          (fieldNames, initialValue) => {
            const initialValues: Record<string, any> = {}
            for (const name of fieldNames) {
              initialValues[name] = initialValue
            }

            const form = createFormInstance({
              initialValues: initialValues as any,
            })

            let callCount = 0
            let receivedCurrentValues: Record<string, any> = {}

            createWatchFields(
              form,
              fieldNames,
              (currentValues, _prevValues) => {
                callCount++
                receivedCurrentValues = currentValues
              },
              { immediate: true }
            )

            expect(callCount).toBe(1)
            // immediate 回调应包含所有被监听字段的当前值
            for (const name of fieldNames) {
              expect(receivedCurrentValues[name]).toEqual(initialValue)
            }

            form.destroy()
          }
        ),
        { numRuns: 100 }
      )
    })

    it("createWatchAll: immediate: true 时应在创建后立即执行一次回调", () => {
      fc.assert(
        fc.property(fieldNameArb, safeValueArb, (fieldName, initialValue) => {
          const form = createFormInstance({
            initialValues: { [fieldName]: initialValue } as any,
          })

          let callCount = 0
          let receivedSnapshot: any = undefined

          createWatchAll(
            form,
            (latestSnapshot) => {
              callCount++
              receivedSnapshot = latestSnapshot
            },
            { immediate: true }
          )

          expect(callCount).toBe(1)
          expect(receivedSnapshot).toBeDefined()
          expect(receivedSnapshot[fieldName]).toEqual(initialValue)

          form.destroy()
        }),
        { numRuns: 100 }
      )
    })
  })

  // Feature: pure-signal-core-refactor, Property 15: inequality 选项跳过相等值
  // **Validates: Requirements 9.11**
  describe("Property 15: inequality 选项跳过相等值", () => {
    it("createWatchField: inequality: true 且新旧值深度相等时不应触发回调", () => {
      fc.assert(
        fc.property(fieldNameArb, safeValueArb, (fieldName, value) => {
          const form = createFormInstance({
            initialValues: { [fieldName]: value } as any,
          })

          let callCount = 0

          createWatchField(
            form,
            fieldName,
            () => {
              callCount++
            },
            { inequality: true }
          )

          // 设置深度相等的值，不应触发回调
          const clonedValue = JSON.parse(JSON.stringify(value))
          form.setFieldValue(fieldName, clonedValue)

          expect(callCount).toBe(0)

          form.destroy()
        }),
        { numRuns: 100 }
      )
    })

    it("createWatchFields: inequality: true 且新旧值深度相等时不应触发回调", () => {
      fc.assert(
        fc.property(fieldNameArb, safeValueArb, (fieldName, value) => {
          const form = createFormInstance({
            initialValues: { [fieldName]: value } as any,
          })

          let callCount = 0

          createWatchFields(
            form,
            [fieldName],
            () => {
              callCount++
            },
            { inequality: true }
          )

          // 设置深度相等的值，不应触发回调
          const clonedValue = JSON.parse(JSON.stringify(value))
          form.setFieldValue(fieldName, clonedValue)

          expect(callCount).toBe(0)

          form.destroy()
        }),
        { numRuns: 100 }
      )
    })

    it("createWatchAll: inequality: true 且新旧值深度相等时不应触发回调", () => {
      fc.assert(
        fc.property(fieldNameArb, safeValueArb, (fieldName, value) => {
          const form = createFormInstance({
            initialValues: { [fieldName]: value } as any,
          })

          let callCount = 0

          createWatchAll(
            form,
            () => {
              callCount++
            },
            { inequality: true }
          )

          // 设置深度相等的值，不应触发回调
          const clonedValue = JSON.parse(JSON.stringify(value))
          form.setFieldValue(fieldName, clonedValue)

          expect(callCount).toBe(0)

          form.destroy()
        }),
        { numRuns: 100 }
      )
    })
  })

  // Feature: pure-signal-core-refactor, Property 16: dispose 停止后续回调
  // **Validates: Requirements 9.12**
  describe("Property 16: dispose 停止后续回调", () => {
    it("createWatchField: dispose 后即使字段值变化也不应触发回调", () => {
      fc.assert(
        fc.property(
          fieldNameArb,
          safeValueArb,
          safeValueArb,
          (fieldName, initialValue, newValueRaw) => {
            const newValue =
              JSON.stringify(initialValue) === JSON.stringify(newValueRaw)
                ? "___different___"
                : newValueRaw

            const form = createFormInstance({
              initialValues: { [fieldName]: initialValue } as any,
            })

            let callCount = 0

            const dispose = createWatchField(
              form,
              fieldName,
              () => {
                callCount++
              },
              {}
            )

            // 先 dispose 再修改值
            dispose()
            form.setFieldValue(fieldName, newValue)

            expect(callCount).toBe(0)

            form.destroy()
          }
        ),
        { numRuns: 100 }
      )
    })

    it("createWatchFields: dispose 后即使字段值变化也不应触发回调", () => {
      fc.assert(
        fc.property(
          fieldNameArb,
          safeValueArb,
          safeValueArb,
          (fieldName, initialValue, newValueRaw) => {
            const newValue =
              JSON.stringify(initialValue) === JSON.stringify(newValueRaw)
                ? "___different___"
                : newValueRaw

            const form = createFormInstance({
              initialValues: { [fieldName]: initialValue } as any,
            })

            let callCount = 0

            const dispose = createWatchFields(
              form,
              [fieldName],
              () => {
                callCount++
              },
              {}
            )

            dispose()
            form.setFieldValue(fieldName, newValue)

            expect(callCount).toBe(0)

            form.destroy()
          }
        ),
        { numRuns: 100 }
      )
    })

    it("createWatchAll: dispose 后即使字段值变化也不应触发回调", () => {
      fc.assert(
        fc.property(
          fieldNameArb,
          safeValueArb,
          safeValueArb,
          (fieldName, initialValue, newValueRaw) => {
            const newValue =
              JSON.stringify(initialValue) === JSON.stringify(newValueRaw)
                ? "___different___"
                : newValueRaw

            const form = createFormInstance({
              initialValues: { [fieldName]: initialValue } as any,
            })

            let callCount = 0

            const dispose = createWatchAll(
              form,
              () => {
                callCount++
              },
              {}
            )

            dispose()
            form.setFieldValue(fieldName, newValue)

            expect(callCount).toBe(0)

            form.destroy()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
