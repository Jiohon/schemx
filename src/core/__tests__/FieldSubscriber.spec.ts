/**
 * FieldSubscriber 单元测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

import { createFieldSubscriber, FieldSubscriber, type ValueGetter } from "../subscriber"

describe("FieldSubscriber", () => {
  let valueGetter: ValueGetter
  let values: Record<string, any>
  let subscriber: FieldSubscriber

  beforeEach(() => {
    values = {
      name: "John",
      age: 25,
      user: {
        address: {
          city: "Beijing",
          street: "Main St",
        },
      },
    }

    valueGetter = {
      getFieldValue: (path: string) => {
        const parts = path.split(".")
        let result: any = values
        for (const part of parts) {
          result = result?.[part]
        }

        return result
      },
      getFieldsValue: () => ({ ...values }),
    }

    subscriber = new FieldSubscriber({ valueGetter })
  })

  describe("subscribe", () => {
    it("应该订阅字段并返回取消订阅函数", () => {
      const callback = vi.fn()
      const unsubscribe = subscriber.subscribe("name", callback)

      expect(typeof unsubscribe).toBe("function")
      expect(subscriber.getFieldSubscriberCount()).toBe(1)

      unsubscribe()
      expect(subscriber.getFieldSubscriberCount()).toBe(0)
    })

    it("应该支持多个订阅者订阅同一字段", () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      subscriber.subscribe("name", callback1)
      subscriber.subscribe("name", callback2)

      expect(subscriber.getFieldSubscriberCount()).toBe(2)
    })

    it("应该支持订阅不同字段", () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      subscriber.subscribe("name", callback1)
      subscriber.subscribe("age", callback2)

      expect(subscriber.getFieldSubscriberCount()).toBe(2)
    })
  })

  describe("subscribeAll", () => {
    it("应该订阅全局变化并返回取消订阅函数", () => {
      const callback = vi.fn()
      const unsubscribe = subscriber.subscribeAll(callback)

      expect(typeof unsubscribe).toBe("function")
      expect(subscriber.getGlobalSubscriberCount()).toBe(1)

      unsubscribe()
      expect(subscriber.getGlobalSubscriberCount()).toBe(0)
    })
  })

  describe("notifyField", () => {
    it("应该通知精确匹配的订阅者", () => {
      const callback = vi.fn()
      subscriber.subscribe("name", callback)

      subscriber.notifyField("name", "Jane")

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith("name", "Jane", expect.any(Object))
    })

    it("应该通知父路径的订阅者（子路径变化时）", () => {
      const callback = vi.fn()
      subscriber.subscribe("user.address", callback)

      subscriber.notifyField("user.address.city", "Shanghai")

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        "user.address",
        { city: "Beijing", street: "Main St" },
        expect.any(Object)
      )
    })

    it("应该通知子路径的订阅者（父路径变化时）", () => {
      const callback = vi.fn()
      subscriber.subscribe("user.address.city", callback)

      subscriber.notifyField("user.address", { city: "Shanghai", street: "New St" })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        "user.address.city",
        "Beijing", // 从 valueGetter 获取的当前值
        expect.any(Object)
      )
    })

    it("应该避免重复通知同一回调", () => {
      const callback = vi.fn()
      // 同一个回调订阅父路径和子路径
      subscriber.subscribe("user", callback)
      subscriber.subscribe("user.address", callback)

      subscriber.notifyField("user.address.city", "Shanghai")

      // 应该只通知一次
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it("应该捕获回调中的错误", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Test error")
      })
      const normalCallback = vi.fn()

      subscriber.subscribe("name", errorCallback)
      subscriber.subscribe("name", normalCallback)

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      subscriber.notifyField("name", "Jane")

      expect(consoleSpy).toHaveBeenCalled()
      expect(normalCallback).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe("notifyGlobal", () => {
    it("应该通知全局订阅者", () => {
      const callback = vi.fn()
      subscriber.subscribeAll(callback)

      subscriber.notifyGlobal({ name: "Jane" })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith({ name: "Jane" }, expect.any(Object))
    })

    it("没有全局订阅者时不应报错", () => {
      expect(() => {
        subscriber.notifyGlobal({ name: "Jane" })
      }).not.toThrow()
    })

    it("应该捕获回调中的错误", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Test error")
      })

      subscriber.subscribeAll(errorCallback)

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      subscriber.notifyGlobal({ name: "Jane" })

      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe("clear", () => {
    it("应该清除所有订阅", () => {
      subscriber.subscribe("name", vi.fn())
      subscriber.subscribe("age", vi.fn())
      subscriber.subscribeAll(vi.fn())

      expect(subscriber.getFieldSubscriberCount()).toBe(2)
      expect(subscriber.getGlobalSubscriberCount()).toBe(1)

      subscriber.clear()

      expect(subscriber.getFieldSubscriberCount()).toBe(0)
      expect(subscriber.getGlobalSubscriberCount()).toBe(0)
    })
  })

  describe("createFieldSubscriber", () => {
    it("应该创建 FieldSubscriber 实例", () => {
      const instance = createFieldSubscriber({ valueGetter })
      expect(instance).toBeInstanceOf(FieldSubscriber)
    })
  })

  describe("嵌套路径通知", () => {
    it("应该正确处理多层嵌套路径", () => {
      const rootCallback = vi.fn()
      const userCallback = vi.fn()
      const addressCallback = vi.fn()
      const cityCallback = vi.fn()

      subscriber.subscribe("user", rootCallback)
      subscriber.subscribe("user.address", addressCallback)
      subscriber.subscribe("user.address.city", cityCallback)

      // 当 city 变化时
      subscriber.notifyField("user.address.city", "Shanghai")

      // 精确匹配
      expect(cityCallback).toHaveBeenCalledWith(
        "user.address.city",
        "Shanghai",
        expect.any(Object)
      )
      // 父路径
      expect(addressCallback).toHaveBeenCalled()
      expect(rootCallback).toHaveBeenCalled()
    })

    it("应该正确处理顶层路径变化", () => {
      const addressCallback = vi.fn()
      const cityCallback = vi.fn()
      const streetCallback = vi.fn()

      subscriber.subscribe("user.address", addressCallback)
      subscriber.subscribe("user.address.city", cityCallback)
      subscriber.subscribe("user.address.street", streetCallback)

      // 当 address 整体变化时
      subscriber.notifyField("user.address", { city: "Shanghai", street: "New St" })

      // 精确匹配
      expect(addressCallback).toHaveBeenCalled()
      // 子路径
      expect(cityCallback).toHaveBeenCalled()
      expect(streetCallback).toHaveBeenCalled()
    })
  })
})
