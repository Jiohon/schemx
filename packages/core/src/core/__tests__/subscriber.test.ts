/**
 * Subscriber 单元测试
 *
 * 覆盖 Subscriber 的所有公开 API：
 * subscribe、subscribeFields、subscribeAll、notify、clear、getSubscriberCount。
 *
 * @module core/__tests__/subscriber
 */

import { describe, expect, it, vi } from "vitest"

import { createSubscriber, Subscriber } from "../subscriber"

interface TestForm {
  name: string
  age: number
  email: string
}

describe("Subscriber", () => {
  describe("subscribe（单字段订阅）", () => {
    it("注册订阅并在字段变化时触发回调", () => {
      const sub = new Subscriber<TestForm>()
      const cb = vi.fn()

      sub.subscribe("name", cb)
      sub.notify(
        { name: "Jane" },
        { name: "John", age: 25, email: "j@t.com" },
        { name: "Jane", age: 25, email: "j@t.com" }
      )

      expect(cb).toHaveBeenCalledOnce()
      expect(cb.mock.calls[0][0]).toEqual({
        path: "name",
        value: "Jane",
        prevValue: "John",
      })
    })

    it("未变化的字段不触发回调", () => {
      const sub = new Subscriber<TestForm>()
      const cb = vi.fn()

      sub.subscribe("age", cb)
      sub.notify(
        { name: "Jane" },
        { name: "John", age: 25, email: "j@t.com" },
        { name: "Jane", age: 25, email: "j@t.com" }
      )

      expect(cb).not.toHaveBeenCalled()
    })

    it("取消订阅后不再触发", () => {
      const sub = new Subscriber<TestForm>()
      const cb = vi.fn()

      const unsub = sub.subscribe("name", cb)
      unsub()

      sub.notify(
        { name: "Jane" },
        { name: "John", age: 25, email: "j@t.com" },
        { name: "Jane", age: 25, email: "j@t.com" }
      )

      expect(cb).not.toHaveBeenCalled()
    })

    it("同一字段多个订阅者都触发", () => {
      const sub = new Subscriber<TestForm>()
      const cb1 = vi.fn()
      const cb2 = vi.fn()

      sub.subscribe("name", cb1)
      sub.subscribe("name", cb2)

      sub.notify(
        { name: "Jane" },
        { name: "John", age: 25, email: "j@t.com" },
        { name: "Jane", age: 25, email: "j@t.com" }
      )

      expect(cb1).toHaveBeenCalledOnce()
      expect(cb2).toHaveBeenCalledOnce()
    })

    it("null/undefined 路径订阅返回空函数", () => {
      const sub = new Subscriber<TestForm>()
      const unsub1 = sub.subscribe(null as any, vi.fn())
      const unsub2 = sub.subscribe(undefined as any, vi.fn())
      expect(typeof unsub1).toBe("function")
      expect(typeof unsub2).toBe("function")
      expect(sub.getSubscriberCount()).toBe(0)
    })
  })

  describe("subscribeFields（多字段组订阅）", () => {
    it("任一订阅字段变化时触发回调", () => {
      const sub = new Subscriber<TestForm>()
      const cb = vi.fn()

      sub.subscribeFields(["name", "age"], cb)

      sub.notify(
        { name: "Jane" },
        { name: "John", age: 25, email: "j@t.com" },
        { name: "Jane", age: 25, email: "j@t.com" }
      )

      expect(cb).toHaveBeenCalledOnce()
      const payload = cb.mock.calls[0][0]
      expect(payload.changedValues).toBeDefined()
      expect(payload.prevValues).toBeDefined()
    })

    it("非订阅字段变化时不触发", () => {
      const sub = new Subscriber<TestForm>()
      const cb = vi.fn()

      sub.subscribeFields(["name", "age"], cb)

      sub.notify(
        { email: "new@t.com" },
        { name: "John", age: 25, email: "j@t.com" },
        { name: "John", age: 25, email: "new@t.com" }
      )

      expect(cb).not.toHaveBeenCalled()
    })

    it("同一组多个回调都触发", () => {
      const sub = new Subscriber<TestForm>()
      const cb1 = vi.fn()
      const cb2 = vi.fn()

      sub.subscribeFields(["name", "age"], cb1)
      sub.subscribeFields(["name", "age"], cb2)

      sub.notify(
        { name: "Jane" },
        { name: "John", age: 25, email: "j@t.com" },
        { name: "Jane", age: 25, email: "j@t.com" }
      )

      expect(cb1).toHaveBeenCalledOnce()
      expect(cb2).toHaveBeenCalledOnce()
    })

    it("路径顺序不同视为同一组", () => {
      const sub = new Subscriber<TestForm>()
      const cb1 = vi.fn()
      const cb2 = vi.fn()

      sub.subscribeFields(["name", "age"], cb1)
      sub.subscribeFields(["age", "name"], cb2)

      sub.notify(
        { age: 30 },
        { name: "John", age: 25, email: "j@t.com" },
        { name: "John", age: 30, email: "j@t.com" }
      )

      expect(cb1).toHaveBeenCalledOnce()
      expect(cb2).toHaveBeenCalledOnce()
    })

    it("取消订阅后不再触发，组内无回调时自动清理", () => {
      const sub = new Subscriber<TestForm>()
      const cb = vi.fn()

      const unsub = sub.subscribeFields(["name", "age"], cb)
      unsub()

      sub.notify(
        { name: "Jane" },
        { name: "John", age: 25, email: "j@t.com" },
        { name: "Jane", age: 25, email: "j@t.com" }
      )

      expect(cb).not.toHaveBeenCalled()
      expect(sub.getSubscriberCount()).toBe(0)
    })

    it("空路径数组返回空函数", () => {
      const sub = new Subscriber<TestForm>()
      const unsub = sub.subscribeFields([], vi.fn())
      expect(typeof unsub).toBe("function")
      expect(sub.getSubscriberCount()).toBe(0)
    })
  })

  describe("subscribeAll（全局订阅）", () => {
    it("任意字段变化都触发", () => {
      const sub = new Subscriber<TestForm>()
      const cb = vi.fn()

      sub.subscribeAll(cb)

      sub.notify(
        { email: "new@t.com" },
        { name: "John", age: 25, email: "j@t.com" },
        { name: "John", age: 25, email: "new@t.com" }
      )

      expect(cb).toHaveBeenCalledOnce()
      const payload = cb.mock.calls[0][0]
      expect(payload.changedPaths).toContain("email")
      expect(payload.changedValues).toEqual({ email: "new@t.com" })
    })

    it("取消订阅后不再触发", () => {
      const sub = new Subscriber<TestForm>()
      const cb = vi.fn()

      const unsub = sub.subscribeAll(cb)
      unsub()

      sub.notify(
        { name: "Jane" },
        { name: "John", age: 25, email: "j@t.com" },
        { name: "Jane", age: 25, email: "j@t.com" }
      )

      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe("notify（批量通知）", () => {
    it("同时触发字段级、多字段组和全局订阅", () => {
      const sub = new Subscriber<TestForm>()
      const fieldCb = vi.fn()
      const fieldsCb = vi.fn()
      const globalCb = vi.fn()

      sub.subscribe("name", fieldCb)
      sub.subscribeFields(["name", "age"], fieldsCb)
      sub.subscribeAll(globalCb)

      sub.notify(
        { name: "Jane" },
        { name: "John", age: 25, email: "j@t.com" },
        { name: "Jane", age: 25, email: "j@t.com" }
      )

      expect(fieldCb).toHaveBeenCalledOnce()
      expect(fieldsCb).toHaveBeenCalledOnce()
      expect(globalCb).toHaveBeenCalledOnce()
    })

    it("多字段同时变化时各订阅者都收到通知", () => {
      const sub = new Subscriber<TestForm>()
      const nameCb = vi.fn()
      const ageCb = vi.fn()

      sub.subscribe("name", nameCb)
      sub.subscribe("age", ageCb)

      sub.notify(
        { name: "Jane", age: 30 },
        { name: "John", age: 25, email: "j@t.com" },
        { name: "Jane", age: 30, email: "j@t.com" }
      )

      expect(nameCb).toHaveBeenCalledOnce()
      expect(ageCb).toHaveBeenCalledOnce()
    })

    it("回调接收正确的 prevSnapshot 和 latestSnapshot", () => {
      const sub = new Subscriber<TestForm>()
      const cb = vi.fn()

      const prev = { name: "John", age: 25, email: "j@t.com" }
      const latest = { name: "Jane", age: 25, email: "j@t.com" }

      sub.subscribe("name", cb)
      sub.notify({ name: "Jane" }, prev, latest)

      expect(cb.mock.calls[0][1]).toBe(prev)
      expect(cb.mock.calls[0][2]).toBe(latest)
    })
  })

  describe("clear", () => {
    it("清除所有订阅", () => {
      const sub = new Subscriber<TestForm>()

      sub.subscribe("name", vi.fn())
      sub.subscribeFields(["name", "age"], vi.fn())
      sub.subscribeAll(vi.fn())

      expect(sub.getSubscriberCount()).toBeGreaterThan(0)

      sub.clear()
      expect(sub.getSubscriberCount()).toBe(0)
    })
  })

  describe("getSubscriberCount", () => {
    it("传入路径返回该字段订阅者数量", () => {
      const sub = new Subscriber<TestForm>()
      sub.subscribe("name", vi.fn())
      sub.subscribe("name", vi.fn())
      sub.subscribe("age", vi.fn())

      expect(sub.getSubscriberCount("name")).toBe(2)
      expect(sub.getSubscriberCount("age")).toBe(1)
      expect(sub.getSubscriberCount("email")).toBe(0)
    })

    it("无参返回所有订阅者总数", () => {
      const sub = new Subscriber<TestForm>()
      sub.subscribe("name", vi.fn()) // +1
      sub.subscribeFields(["name", "age"], vi.fn()) // +1
      sub.subscribeAll(vi.fn()) // +1

      expect(sub.getSubscriberCount()).toBe(3)
    })
  })

  describe("createSubscriber 工厂函数", () => {
    it("创建 Subscriber 实例", () => {
      const sub = createSubscriber<TestForm>()
      expect(sub).toBeInstanceOf(Subscriber)
    })
  })
})
