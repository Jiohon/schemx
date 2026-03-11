/**
 * Preservation 保持性属性测试。
 *
 * 验证非 Bug 条件下的行为保持不变，确保修复不引入回归。
 * 在未修复代码上运行时应全部通过，捕获基线行为。
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 *
 * @module core/__tests__/preservation
 */

import { defineComponent } from "vue"

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"

import { Registry } from "../registry"
import { createRequiredSchema } from "../standardSchema"
import { FormStore } from "../store"
import { createSubscriber } from "../subscriber"
import { Validator } from "../validator"

/** 用于测试的简单 Vue 组件 */
const DummyComponent = defineComponent({ render: () => null })
const DummyComponent2 = defineComponent({ render: () => null })
const DummyComponent3 = defineComponent({ render: () => null })

interface TestForm {
  name: string
  age: number
  email: string
}

describe("Preservation 保持性属性测试", () => {
  /**
   * 保持 1: getInitialValues() 不传参 → 返回全量初始值深拷贝。
   *
   * 使用 fast-check 生成随机 initialValues 对象，验证无参调用
   * 返回的值与原始 initialValues 深度相等且为独立拷贝。
   *
   * **Validates: Requirements 3.1**
   */
  it("保持 1: getInitialValues() 不传参返回全量初始值深拷贝", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 20 }),
          age: fc.integer({ min: 0, max: 150 }),
          email: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (initialValues) => {
          const store = new FormStore<TestForm>({
            initialValues: initialValues as TestForm,
          })

          const result = store.getInitialValues()

          // 值应与原始 initialValues 深度相等
          expect(result).toEqual(initialValues)

          // 应为独立拷贝，修改返回值不影响 store 内部状态
          ;(result as any).name = "__modified__"
          const result2 = store.getInitialValues()
          expect(result2).toEqual(initialValues)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * 保持 2: isFieldsTouched() 不传参 → 检查是否有任一字段被修改并返回布尔值。
   *
   * **Validates: Requirements 3.2**
   */
  it("保持 2: isFieldsTouched() 不传参检查任一字段是否被修改", () => {
    // 未修改任何字段时应返回 false
    const store1 = new FormStore<TestForm>({
      initialValues: { name: "John", age: 25, email: "john@test.com" },
    })
    expect(store1.isFieldsTouched()).toBe(false)

    // 修改一个字段后应返回 true
    const store2 = new FormStore<TestForm>({
      initialValues: { name: "John", age: 25, email: "john@test.com" },
    })
    store2.setFieldValue("name", "Jane")
    expect(store2.isFieldsTouched()).toBe(true)
  })

  /**
   * 保持 3: subscribe('name', callback) 正常字符串路径 → 正确注册订阅并返回取消函数。
   *
   * 使用 fast-check 生成随机非空字符串路径，验证订阅注册和取消行为。
   *
   * **Validates: Requirements 3.3**
   */
  it("保持 3: subscribe(stringPath, callback) 正常字符串路径正确注册订阅", () => {
    fc.assert(
      fc.property(
        // 生成非空字符串路径（排除空字符串，因为空字符串是 falsy 值属于 bug 条件）
        fc.string({ minLength: 1, maxLength: 30 }),
        (path) => {
          const subscriber = createSubscriber<Record<string, any>>()
          const callback = () => {}

          // 订阅应成功注册
          const unsubscribe = subscriber.subscribe(path, callback)

          // 订阅者数量应为 1
          expect(subscriber.getSubscriberCount(path)).toBe(1)

          // 取消订阅后数量应为 0
          unsubscribe()
          expect(subscriber.getSubscriberCount(path)).toBe(0)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * 保持 4: getSubscriberCount('name') 传入具体路径 → 返回该字段订阅者数量。
   *
   * **Validates: Requirements 3.4**
   */
  it("保持 4: getSubscriberCount(path) 传入路径返回该字段订阅者数量", () => {
    fc.assert(
      fc.property(
        // 生成 1-5 个订阅者
        fc.integer({ min: 1, max: 5 }),
        (subscriberCount) => {
          const subscriber = createSubscriber<TestForm>()

          // 注册指定数量的订阅者
          const unsubscribes: (() => void)[] = []
          for (let i = 0; i < subscriberCount; i++) {
            unsubscribes.push(subscriber.subscribe("name", () => {}))
          }

          // 数量应匹配
          expect(subscriber.getSubscriberCount("name")).toBe(subscriberCount)

          // 取消一个后数量减 1
          unsubscribes[0]()
          expect(subscriber.getSubscriberCount("name")).toBe(subscriberCount - 1)
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * 保持 5: validateField('email', values) 单字段校验 → 正常校验并返回正确结果。
   *
   * **Validates: Requirements 3.5**
   */
  it("保持 5: validateField 单字段校验正常工作", async () => {
    const validator = new Validator<TestForm>()

    // 注册 email 必填规则
    validator.registerRule("email", createRequiredSchema("邮箱不能为空"))

    // 校验有值的情况 → 通过
    const validResult = await validator.validateField("email", {
      name: "John",
      age: 25,
      email: "john@test.com",
    } as TestForm)
    expect(validResult.ok).toBe(true)

    // 校验空值的情况 → 失败
    const invalidResult = await validator.validateField("email", {
      name: "John",
      age: 25,
      email: "",
    } as TestForm)
    expect(invalidResult.ok).toBe(false)
    if (!invalidResult.ok) {
      expect(invalidResult.error.errors[0].message).toContain("邮箱不能为空")
    }

    // 校验未注册规则的字段 → 通过
    const noRuleResult = await validator.validateField("name", {
      name: "John",
      age: 25,
      email: "john@test.com",
    } as TestForm)
    expect(noRuleResult.ok).toBe(true)
  })

  /**
   * 保持 6: unregister(nonDefaultType) 移除非默认类型 → 正常移除且 defaultType 不变。
   *
   * **Validates: Requirements 3.6**
   */
  it("保持 6: unregister 移除非默认类型时 defaultType 不变", () => {
    const registry = new Registry()

    // 注册多个渲染器
    registry.register("text", DummyComponent)
    registry.register("number", DummyComponent2)
    registry.register("select", DummyComponent3)

    // 默认类型为 text
    registry.setDefault("text")
    expect(registry.getDefault()).toBe("text")

    // 移除非默认类型 number
    const removed = registry.unregister("number")
    expect(removed).toBe(true)

    // defaultType 应保持不变
    expect(registry.getDefault()).toBe("text")

    // number 渲染器应已被移除
    expect(registry.hasRenderer("number")).toBe(false)

    // text 和 select 渲染器应仍存在
    expect(registry.hasRenderer("text")).toBe(true)
    expect(registry.hasRenderer("select")).toBe(true)
  })

  /**
   * 保持 7: register、getRenderer、hasRenderer、setDefault 等方法保持现有行为。
   *
   * **Validates: Requirements 3.7**
   */
  it("保持 7: Registry 基础方法保持现有行为", () => {
    const registry = new Registry()

    // register: 注册渲染器
    registry.register("text", DummyComponent)
    registry.register("number", DummyComponent2)

    // hasRenderer: 检查渲染器是否存在
    expect(registry.hasRenderer("text")).toBe(true)
    expect(registry.hasRenderer("number")).toBe(true)
    expect(registry.hasRenderer("nonexistent")).toBe(false)

    // getRenderer: 获取已注册的渲染器
    expect(registry.getRenderer("text")).toBe(DummyComponent)
    expect(registry.getRenderer("number")).toBe(DummyComponent2)

    // getRenderer: 未找到时回退到默认类型
    const fallback = registry.getRenderer("unknown")
    expect(fallback).toBe(DummyComponent) // 回退到 text（默认类型）

    // setDefault: 设置默认渲染器类型
    registry.setDefault("number")
    expect(registry.getDefault()).toBe("number")

    // setDefault: 设置未注册的类型无效
    registry.setDefault("nonexistent")
    expect(registry.getDefault()).toBe("number") // 保持不变

    // getTypes: 获取所有已注册类型
    expect(registry.getTypes()).toEqual(expect.arrayContaining(["text", "number"]))

    // size: 获取渲染器数量
    expect(registry.size()).toBe(2)

    // register with override: false 不覆盖已存在的渲染器
    registry.register("text", DummyComponent3, { override: false })
    expect(registry.getRenderer("text")).toBe(DummyComponent) // 仍为原组件
  })
})
