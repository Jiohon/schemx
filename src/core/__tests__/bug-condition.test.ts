/**
 * Bug Condition 探索性测试。
 *
 * 在未修复代码上运行，通过反例证明 6 个边界情况缺陷确实存在。
 * 测试失败是预期行为，表示 bug 已被成功复现。
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
 *
 * @module core/__tests__/bug-condition
 */

import { defineComponent } from "vue"

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"

import { Registry } from "../registry"
import { createRequiredSchema } from "../standardSchema"
import { FormStore } from "../store"
import { createSubscriber } from "../subscriber"
import { Validator } from "../validator"

import type { NamePath } from "../../types"

/** 用于测试的简单 Vue 组件 */
const DummyComponent = defineComponent({ render: () => null })
const DummyComponent2 = defineComponent({ render: () => null })

interface TestForm {
  name: string
  age: number
  email: string
}

describe("Bug Condition 探索性测试", () => {
  /**
   * Bug 1: getInitialValues 使用 for...in 遍历数组，
   * 得到索引字符串 "0", "1" 而非数组元素值 'name', 'age'。
   *
   * **Validates: Requirements 1.1**
   */
  it("Bug 1: getInitialValues(paths) 应返回路径对应的正确值", () => {
    const store = new FormStore<TestForm>({
      initialValues: { name: "John", age: 25, email: "john@test.com" },
    })

    const result = store.getInitialValues(["name", "age"])

    // 未修复代码将返回 { "0": undefined, "1": undefined }
    // 修复后应返回 { name: 'John', age: 25 }
    expect(result).toEqual({ name: "John", age: 25 })
  })

  /**
   * Bug 2: isFieldsTouched 参数类型为 NamePath<T> 而非 NamePath<T>[]，
   * 传入多个路径时，['name', 'age'] 被解释为元组路径而非路径数组。
   *
   * 运行时 Array.isArray 判断可以工作，但类型签名导致语义混淆：
   * ['name', 'age'] 作为 NamePath<T> 表示嵌套路径 name.age，
   * 而作为 NamePath<T>[] 表示两个独立路径 name 和 age。
   *
   * **Validates: Requirements 1.2**
   */
  it("Bug 2: isFieldsTouched(paths) 应正确检查多个字段是否被修改", () => {
    const store = new FormStore<TestForm>({
      initialValues: { name: "John", age: 25, email: "john@test.com" },
    })

    // 修改 name 和 age 字段
    store.setFieldValue("name", "Jane")
    store.setFieldValue("age", 30)

    // 当前类型声明参数为 NamePath<T>，传入 ['name', 'age'] 被解释为元组路径
    // 而非两个独立路径的数组。这是类型层面的 bug。
    // 运行时 Array.isArray 判断为 true，paths.every 会遍历 'name' 和 'age'
    // 但 isFieldTouched('name') 和 isFieldTouched('age') 都返回 true，所以结果正确。
    // 真正的问题是：当只修改 name 不修改 age 时，
    // isFieldsTouched(['name', 'age']) 应返回 false（不是所有字段都被修改），
    // 但如果类型被解释为元组路径 ['name', 'age']（即 name.age），
    // 则行为完全不同。
    const store2 = new FormStore<TestForm>({
      initialValues: { name: "John", age: 25, email: "john@test.com" },
    })

    // 只修改 name，不修改 age
    store2.setFieldValue("name", "Jane")

    // 作为 NamePath<T>[]（路径数组）：检查 name 和 age 是否都被修改 → false
    // 作为 NamePath<T>（元组路径）：检查 name.age 是否被修改 → 不存在该路径
    // @ts-expect-error 类型签名为 NamePath<T>，不接受 NamePath<T>[] 语义的参数
    const result: boolean = store2.isFieldsTouched([
      "name",
      "age",
    ] as NamePath<TestForm>[])

    // 运行时 Array.isArray 为 true，paths.every 检查 name(touched) 和 age(not touched)
    // 应返回 false（不是所有字段都被修改）
    expect(result).toBe(false)
  })

  /**
   * Bug 3: subscribe 中 !path 对 falsy 值误判。
   * 数字 0 是合法的 NamePath 值（数组索引），但 !0 为 true，
   * 导致合法订阅被拒绝。
   *
   * 使用 fast-check 验证数字 0 作为路径值的订阅行为。
   *
   * **Validates: Requirements 1.3**
   */
  it("Bug 3: subscribe(0, callback) 应正确注册订阅", () => {
    fc.assert(
      fc.property(
        // 数字 0 是最关键的 falsy 值，也是合法的 NamePath（数组索引）
        fc.constant(0),
        (path) => {
          const subscriber = createSubscriber<Record<string, any>>()
          const callback = () => {}

          subscriber.subscribe(path as any, callback)

          // 未修复代码因 !0 === true 返回空函数，订阅者数量为 0
          // 修复后应正确注册，订阅者数量为 1
          const count = subscriber.getSubscriberCount(path as any)
          expect(count).toBe(1)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Bug 4: getSubscriberCount() 无参调用时遗漏 fieldsSubscribers 计数。
   * 只累加了 fieldSubscribers 和 globalSubscribers，
   * 完全遗漏了 fieldsSubscribers（多字段组订阅）中的回调数量。
   *
   * **Validates: Requirements 1.4**
   */
  it("Bug 4: getSubscriberCount() 应返回所有三类订阅者的总数", () => {
    const subscriber = createSubscriber<TestForm>()

    // 注册 2 个 field 订阅
    subscriber.subscribe("name", () => {})
    subscriber.subscribe("age", () => {})

    // 注册 3 个 fields 订阅（多字段组）
    subscriber.subscribeFields(["name", "age"], () => {})
    subscriber.subscribeFields(["name", "age"], () => {})
    subscriber.subscribeFields(["name", "age"], () => {})

    // 注册 1 个 global 订阅
    subscriber.subscribeAll(() => {})

    // 未修复代码返回 3（2 field + 1 global，遗漏 3 个 fields 订阅）
    // 修复后应返回 6（2 + 3 + 1）
    const count = subscriber.getSubscriberCount()
    expect(count).toBe(6)
  })

  /**
   * Bug 5: validate 校验前未清空 errors Map，
   * 已注销规则的残留错误被返回。
   *
   * 场景：注册 email 规则并校验失败后，手动设置额外错误，
   * 注销 email 规则，再次 validate 时残留错误未被清除。
   *
   * **Validates: Requirements 1.5**
   */
  it("Bug 5: unregisterRule 后 validate 不应包含残留错误", async () => {
    const validator = new Validator<TestForm>()
    const values = { name: "John", age: 25, email: "" } as TestForm

    // 注册 email 规则（空字符串会校验失败）
    validator.registerRule("email", createRequiredSchema("邮箱不能为空"))

    // 第一次校验，email 为空会失败
    await validator.validate(values)

    // 手动设置一个额外的错误（模拟外部校验逻辑设置的错误）
    validator.setFieldError("name" as any, ["姓名格式不正确"])

    // 注销 email 规则（会清除 email 的错误，但 name 的手动错误仍在）
    validator.unregisterRule("email")

    // 再次校验 - 此时没有任何规则，errors 应该被清空
    const result = await validator.validate(values)

    // 未修复代码因 validate 不清空 errors，name 的残留错误仍在
    // buildResult 读取 state.errors 时会包含残留的 name 错误
    // 修复后 validate 开始前清空 errors，结果应为 ok: true
    expect(result.ok).toBe(true)
    expect(validator.state.errors.size).toBe(0)
  })

  /**
   * Bug 6: unregister 移除默认类型时硬编码重置为 "text"，
   * 但 "text" 可能不存在于已注册渲染器中。
   *
   * **Validates: Requirements 1.6**
   */
  it("Bug 6: unregister(defaultType) 应智能选择剩余渲染器作为新默认", () => {
    const registry = new Registry()

    // 注册 select 和 number 渲染器（不注册 text）
    registry.register("select", DummyComponent)
    registry.register("number", DummyComponent2)

    // 设置 select 为默认类型
    registry.setDefault("select")
    expect(registry.getDefault()).toBe("select")

    // 移除 select（当前默认类型）
    registry.unregister("select")

    // 未修复代码硬编码为 "text"，但 "text" 未注册
    // 修复后应选择剩余渲染器中的第一个（"number"）
    const defaultType = registry.getDefault()
    expect(defaultType).toBe("number")
  })
})
