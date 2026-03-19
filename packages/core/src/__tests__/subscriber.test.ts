/**
 * FormStore 订阅能力单元测试
 *
 * 覆盖 FormStore 的所有订阅相关 API：
 * subscribe、subscribeFields、subscribeAll、clear、getSubscriberCount、destroy。
 *
 * @module core/__tests__/subscriber
 *
 * @remarks
 * 原 Subscriber 模块已合并到 FormStore 中，
 * 此测试文件验证 FormStore 的订阅能力与原 Subscriber 行为一致。
 */

import { describe, expect, it, vi } from "vitest"

import { FormStore } from "../store"

interface TestForm {
  name: string
  age: number
  email: string
}

const defaultValues: TestForm = { name: "John", age: 25, email: "j@t.com" }

describe("FormStore 订阅能力", () => {
  describe("subscribe（单字段订阅）", () => {
    it("注册订阅并在字段变化时触发回调", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const cb = vi.fn()

      store.subscribe("name", cb)
      store.setFieldValue("name", "Jane")

      expect(cb).toHaveBeenCalledOnce()
      expect(cb.mock.calls[0][0]).toEqual({
        path: "name",
        value: "Jane",
        prevValue: "John",
      })
    })

    it("未变化的字段不触发回调", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const cb = vi.fn()

      store.subscribe("age", cb)
      store.setFieldValue("name", "Jane")

      expect(cb).not.toHaveBeenCalled()
    })

    it("取消订阅后不再触发", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const cb = vi.fn()

      const unsub = store.subscribe("name", cb)
      unsub()

      store.setFieldValue("name", "Jane")

      expect(cb).not.toHaveBeenCalled()
    })

    it("同一字段多个订阅者都触发", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const cb1 = vi.fn()
      const cb2 = vi.fn()

      store.subscribe("name", cb1)
      store.subscribe("name", cb2)

      store.setFieldValue("name", "Jane")

      expect(cb1).toHaveBeenCalledOnce()
      expect(cb2).toHaveBeenCalledOnce()
    })

    it("null/undefined 路径订阅返回空函数", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const unsub1 = store.subscribe(null as any, vi.fn())
      const unsub2 = store.subscribe(undefined as any, vi.fn())
      expect(typeof unsub1).toBe("function")
      expect(typeof unsub2).toBe("function")
    })
  })

  describe("subscribeFields（多字段组订阅）", () => {
    it("任一订阅字段变化时触发回调", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const cb = vi.fn()

      store.subscribeFields(["name", "age"], cb)
      store.setFieldValue("name", "Jane")

      expect(cb).toHaveBeenCalledOnce()
      const payload = cb.mock.calls[0][0]
      expect(payload.changedValues).toBeDefined()
      expect(payload.prevValues).toBeDefined()
    })

    it("非订阅字段变化时不触发", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const cb = vi.fn()

      store.subscribeFields(["name", "age"], cb)
      store.setFieldValue("email", "new@t.com")

      expect(cb).not.toHaveBeenCalled()
    })

    it("同一组多个回调都触发", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const cb1 = vi.fn()
      const cb2 = vi.fn()

      store.subscribeFields(["name", "age"], cb1)
      store.subscribeFields(["name", "age"], cb2)

      store.setFieldValue("name", "Jane")

      expect(cb1).toHaveBeenCalledOnce()
      expect(cb2).toHaveBeenCalledOnce()
    })

    it("路径顺序不同视为同一组", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const cb1 = vi.fn()
      const cb2 = vi.fn()

      store.subscribeFields(["name", "age"], cb1)
      store.subscribeFields(["age", "name"], cb2)

      store.setFieldValue("age", 30)

      expect(cb1).toHaveBeenCalledOnce()
      expect(cb2).toHaveBeenCalledOnce()
    })

    it("取消订阅后不再触发，组内无回调时自动清理", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const cb = vi.fn()

      const unsub = store.subscribeFields(["name", "age"], cb)
      unsub()

      store.setFieldValue("name", "Jane")

      expect(cb).not.toHaveBeenCalled()
    })

    it("空路径数组返回空函数", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const unsub = store.subscribeFields([], vi.fn())
      expect(typeof unsub).toBe("function")
    })
  })

  describe("subscribeAll（全局订阅）", () => {
    it("任意字段变化都触发", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const cb = vi.fn()

      store.subscribeAll(cb)
      store.setFieldValue("email", "new@t.com")

      expect(cb).toHaveBeenCalledOnce()
      const payload = cb.mock.calls[0][0]
      expect(payload.changedPaths).toContain("email")
      expect(payload.changedValues).toEqual({ email: "new@t.com" })
    })

    it("取消订阅后不再触发", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const cb = vi.fn()

      const unsub = store.subscribeAll(cb)
      unsub()

      store.setFieldValue("name", "Jane")

      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe("setFieldValue 通知", () => {
    it("同时触发字段级、多字段组和全局订阅", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const fieldCb = vi.fn()
      const fieldsCb = vi.fn()
      const globalCb = vi.fn()

      store.subscribe("name", fieldCb)
      store.subscribeFields(["name", "age"], fieldsCb)
      store.subscribeAll(globalCb)

      store.setFieldValue("name", "Jane")

      expect(fieldCb).toHaveBeenCalledOnce()
      expect(fieldsCb).toHaveBeenCalledOnce()
      expect(globalCb).toHaveBeenCalledOnce()
    })

    it("setFieldsValue 批量变化时各订阅者都收到通知", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const nameCb = vi.fn()
      const ageCb = vi.fn()

      store.subscribe("name", nameCb)
      store.subscribe("age", ageCb)

      store.setFieldsValue({ name: "Jane", age: 30 })

      expect(nameCb).toHaveBeenCalledOnce()
      expect(ageCb).toHaveBeenCalledOnce()
    })

    it("回调接收正确的 prevSnapshot 和 latestSnapshot", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      const cb = vi.fn()

      store.subscribe("name", cb)
      store.setFieldValue("name", "Jane")

      // prevSnapshot 应包含旧值
      const prevSnapshot = cb.mock.calls[0][1]
      expect(prevSnapshot.name).toBe("John")

      // latestSnapshot 应包含新值
      const latestSnapshot = cb.mock.calls[0][2]
      expect(latestSnapshot.name).toBe("Jane")
    })
  })

  describe("clear / destroy", () => {
    it("clear 清除全局和多字段组订阅", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })

      store.subscribeFields(["name", "age"], vi.fn())
      store.subscribeAll(vi.fn())

      store.clear()

      // clear 后全局和多字段组订阅者数量应为 0
      // （effect 订阅不受 clear 影响，需要 destroy）
      const globalCb = vi.fn()
      store.subscribeAll(globalCb)
      store.setFieldValue("name", "Jane")
      expect(globalCb).toHaveBeenCalledOnce()
    })

    it("destroy 清除所有订阅包括 effect", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })

      const fieldCb = vi.fn()
      store.subscribe("name", fieldCb)
      store.subscribeAll(vi.fn())

      store.destroy()

      // destroy 后 effect 订阅也应被清除
      store.setFieldValue("name", "Jane")
      expect(fieldCb).not.toHaveBeenCalled()
    })
  })

  describe("getSubscriberCount", () => {
    it("无参返回所有订阅者总数", () => {
      const store = new FormStore<TestForm>({ initialValues: { ...defaultValues } })
      store.subscribe("name", vi.fn()) // subscribe 由 SignalMap 内部管理，不计入
      store.subscribeFields(["name", "age"], vi.fn()) // +1 fields
      store.subscribeAll(vi.fn()) // +1 global

      expect(store.getSubscriberCount()).toBe(2)
    })
  })
})
