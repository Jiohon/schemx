/**
 * useWatch Hook 单元测试
 *
 * 测试 useWatch hook 的三种监听模式：
 * 1. 单字段监听
 * 2. 多字段监听
 * 3. 全局监听
 */

import { computed, nextTick, ref } from "vue"
import { defineComponent, h, provide } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import { createFormStore, IFormStore } from "../../core/store"
import { FORM_CONTEXT_KEY, type UseFormReturn } from "../useForm"
import { useWatch, useWatchAll, useWatchField, useWatchFields } from "../useWatch"

/**
 * 创建 mock UseFormReturn
 */
function createMockFormContext(store: IFormStore): UseFormReturn {
  return {
    values: computed(() => store.getFieldsValue()),
    errors: ref({}),
    submitting: ref(false),
    schema: ref(null),
    normalizedColumns: computed(() => []),
    setFieldValue: (name: string, value: any) => store.setFieldValue(name, value),
    setFieldsValue: (values: Record<string, any>) => store.setFieldsValue(values),
    getFieldValue: (name: string) => store.getFieldValue(name),
    getFieldsValue: (names?: string[]) => store.getFieldsValue(names),
    getInitialValue: (name: string) => store.getInitialValue(name),
    registerRules: vi.fn(),
    unregisterRules: vi.fn(),
    validate: vi.fn(async () => true),
    getFieldError: vi.fn(() => undefined),
    getErrors: vi.fn(() => ({})),
    submit: vi.fn(async () => {}),
    reset: () => store.reset(),
    resetFields: (names?: string[]) => {
      if (names) {
        names.forEach((name) => store.resetField(name))
      } else {
        store.reset()
      }
    },
    isFieldTouched: (name: string) => store.isFieldTouched(name),
    isFieldsTouched: (names?: string[]) => store.isFieldsTouched(names),
    getTouchedFields: () => store.getTouchedFields(),
    subscribe: (name: string, callback: any) => store.subscribe(name, callback),
    subscribeAll: (callback: any) => store.subscribeAll(callback),
    updateSchema: vi.fn(),
    isReadonly: () => false,
    isDisabled: () => false,
  }
}

/**
 * 创建测试组件的辅助函数
 *
 * 使用父子组件模式：父组件提供 FormContext，子组件使用 useWatch
 */
function createTestComponent(store: IFormStore, watchSetup: () => (() => void) | void) {
  let unsubscribe: (() => void) | void = undefined

  // 子组件：使用 useWatch
  const ChildComponent = defineComponent({
    name: "ChildComponent",
    setup() {
      unsubscribe = watchSetup()

      return () => h("span", "child")
    },
  })

  // 父组件：提供 FormContext
  const ParentComponent = defineComponent({
    name: "ParentComponent",
    setup() {
      // 提供 FormContext
      const mockContext = createMockFormContext(store)
      provide(FORM_CONTEXT_KEY, mockContext)

      return () => h("div", [h(ChildComponent)])
    },
  })

  const wrapper = mount(ParentComponent)

  return {
    wrapper,
    getUnsubscribe: () => unsubscribe,
  }
}

describe("useWatch Hook (Task 11.3)", () => {
  describe("单字段监听 - Requirement 8.3", () => {
    it("应该在字段变化时调用回调", async () => {
      const store = createFormStore({
        initialValues: { name: "John", age: 25 },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatch(callback, "name")
      })

      // 修改字段值
      store.setFieldValue("name", "Jane")
      await nextTick()

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith("Jane", "John", "name")

      wrapper.unmount()
    })

    it("应该传递正确的旧值和新值", async () => {
      const store = createFormStore({
        initialValues: { count: 0 },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatch(callback, "count")
      })

      // 多次修改
      store.setFieldValue("count", 1)
      await nextTick()

      expect(callback).toHaveBeenLastCalledWith(1, 0, "count")

      store.setFieldValue("count", 2)
      await nextTick()

      expect(callback).toHaveBeenLastCalledWith(2, 1, "count")

      wrapper.unmount()
    })

    it("不应该在其他字段变化时调用回调", async () => {
      const store = createFormStore({
        initialValues: { name: "John", age: 25 },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatch(callback, "name")
      })

      // 修改其他字段
      store.setFieldValue("age", 30)
      await nextTick()

      expect(callback).not.toHaveBeenCalled()

      wrapper.unmount()
    })

    it("应该支持嵌套路径", async () => {
      const store = createFormStore({
        initialValues: { user: { address: { city: "Beijing" } } },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatch(callback, "user.address.city")
      })

      store.setFieldValue("user.address.city", "Shanghai")
      await nextTick()

      expect(callback).toHaveBeenCalledWith("Shanghai", "Beijing", "user.address.city")

      wrapper.unmount()
    })

    it("应该支持 immediate 选项", async () => {
      const store = createFormStore({
        initialValues: { name: "John" },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatch(callback, "name", { immediate: true })
      })

      // 应该立即调用一次
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith("John", undefined, "name")

      wrapper.unmount()
    })

    it("取消订阅后不应该再调用回调", async () => {
      const store = createFormStore({
        initialValues: { name: "John" },
      })

      const callback = vi.fn()
      let unsubscribe: (() => void) | undefined

      const { wrapper } = createTestComponent(store, () => {
        unsubscribe = useWatch(callback, "name")

        return unsubscribe
      })

      // 取消订阅
      unsubscribe!()

      // 修改字段值
      store.setFieldValue("name", "Jane")
      await nextTick()

      expect(callback).not.toHaveBeenCalled()

      wrapper.unmount()
    })
  })

  describe("多字段监听 - Requirement 8.4", () => {
    it("应该在任一字段变化时调用回调", async () => {
      const store = createFormStore({
        initialValues: { firstName: "John", lastName: "Doe", age: 25 },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatch(callback, ["firstName", "lastName"])
      })

      // 修改 firstName
      store.setFieldValue("firstName", "Jane")
      await nextTick()

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        { firstName: "Jane", lastName: "Doe" },
        "firstName"
      )

      // 修改 lastName
      store.setFieldValue("lastName", "Smith")
      await nextTick()

      expect(callback).toHaveBeenCalledTimes(2)
      expect(callback).toHaveBeenLastCalledWith(
        { firstName: "Jane", lastName: "Smith" },
        "lastName"
      )

      wrapper.unmount()
    })

    it("不应该在未监听的字段变化时调用回调", async () => {
      const store = createFormStore({
        initialValues: { firstName: "John", lastName: "Doe", age: 25 },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatch(callback, ["firstName", "lastName"])
      })

      // 修改未监听的字段
      store.setFieldValue("age", 30)
      await nextTick()

      expect(callback).not.toHaveBeenCalled()

      wrapper.unmount()
    })

    it("应该返回所有监听字段的当前值", async () => {
      const store = createFormStore({
        initialValues: { a: 1, b: 2, c: 3 },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatch(callback, ["a", "b"])
      })

      store.setFieldValue("a", 10)
      await nextTick()

      // 回调应该收到所有监听字段的值
      expect(callback).toHaveBeenCalledWith({ a: 10, b: 2 }, "a")

      wrapper.unmount()
    })

    it("应该支持 immediate 选项", async () => {
      const store = createFormStore({
        initialValues: { firstName: "John", lastName: "Doe" },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatch(callback, ["firstName", "lastName"], { immediate: true })
      })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        { firstName: "John", lastName: "Doe" },
        "firstName"
      )

      wrapper.unmount()
    })
  })

  describe("全局监听 - Requirement 8.5", () => {
    it("应该在任何字段变化时调用回调", async () => {
      const store = createFormStore({
        initialValues: { name: "John", age: 25 },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatch(callback)
      })

      // 修改 name
      store.setFieldValue("name", "Jane")
      await nextTick()

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        { name: "Jane" },
        expect.objectContaining({ name: "Jane", age: 25 })
      )

      // 修改 age
      store.setFieldValue("age", 30)
      await nextTick()

      expect(callback).toHaveBeenCalledTimes(2)
      expect(callback).toHaveBeenLastCalledWith(
        { age: 30 },
        expect.objectContaining({ name: "Jane", age: 30 })
      )

      wrapper.unmount()
    })

    it("应该在批量更新时只调用一次回调", async () => {
      const store = createFormStore({
        initialValues: { name: "John", age: 25 },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatch(callback)
      })

      // 批量更新
      store.setFieldsValue({ name: "Jane", age: 30 })
      await nextTick()

      // 全局订阅应该只收到一次通知（批量更新合并）
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        { name: "Jane", age: 30 },
        expect.objectContaining({ name: "Jane", age: 30 })
      )

      wrapper.unmount()
    })

    it("应该支持 immediate 选项", async () => {
      const store = createFormStore({
        initialValues: { name: "John", age: 25 },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatch(callback, { immediate: true })
      })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        { name: "John", age: 25 },
        { name: "John", age: 25 }
      )

      wrapper.unmount()
    })
  })

  describe("便捷方法", () => {
    it("useWatchField 应该监听单个字段", async () => {
      const store = createFormStore({
        initialValues: { name: "John" },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatchField("name", callback)
      })

      store.setFieldValue("name", "Jane")
      await nextTick()

      expect(callback).toHaveBeenCalledWith("Jane", "John")

      wrapper.unmount()
    })

    it("useWatchFields 应该监听多个字段", async () => {
      const store = createFormStore({
        initialValues: { firstName: "John", lastName: "Doe" },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatchFields(["firstName", "lastName"], callback)
      })

      store.setFieldValue("firstName", "Jane")
      await nextTick()

      expect(callback).toHaveBeenCalledWith({ firstName: "Jane", lastName: "Doe" })

      wrapper.unmount()
    })

    it("useWatchAll 应该监听所有字段", async () => {
      const store = createFormStore({
        initialValues: { name: "John", age: 25 },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatchAll(callback)
      })

      store.setFieldValue("name", "Jane")
      await nextTick()

      expect(callback).toHaveBeenCalledWith(
        { name: "Jane" },
        expect.objectContaining({ name: "Jane", age: 25 })
      )

      wrapper.unmount()
    })
  })

  describe("组件卸载", () => {
    it("组件卸载时应该自动取消订阅", async () => {
      const store = createFormStore({
        initialValues: { name: "John" },
      })

      const callback = vi.fn()

      const { wrapper } = createTestComponent(store, () => {
        return useWatch(callback, "name")
      })

      // 卸载组件
      wrapper.unmount()

      // 修改字段值
      store.setFieldValue("name", "Jane")
      await nextTick()

      // 回调不应该被调用
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe("无表单上下文", () => {
    it("在没有表单上下文时应该发出警告并返回空函数", () => {
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

      const TestComponent = defineComponent({
        setup() {
          // 不提供 FormContext
          const unsubscribe = useWatch(vi.fn(), "name")
          expect(typeof unsubscribe).toBe("function")

          return () => h("div")
        },
      })

      const wrapper = mount(TestComponent)

      expect(consoleWarn).toHaveBeenCalledWith(
        "[useWatch] 必须在 useForm 提供的上下文中使用"
      )

      consoleWarn.mockRestore()
      wrapper.unmount()
    })
  })
})
