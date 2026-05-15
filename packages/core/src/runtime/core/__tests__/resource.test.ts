/**
 * ResourceMap 模块测试。
 *
 * @module core/runtime/core/__tests__/resource.test
 */

import { describe, expect, it } from "vitest"

import { createResourceKey, createResourceMap } from "../resource"

interface TestModel {
  name: string
  value: number
}

describe("createResourceKey", () => {
  it("应该创建带描述的 ResourceKey", () => {
    const key = createResourceKey<TestModel>("test.model")

    expect(key.id).toBeDefined()
    expect(key.description).toBe("test.model")
    expect(typeof key.id).toBe("symbol")
  })

  it("应该创建唯一的 key.id", () => {
    const key1 = createResourceKey<TestModel>("test.model1")
    const key2 = createResourceKey<TestModel>("test.model2")

    expect(key1.id).not.toBe(key2.id)
  })
})

describe("createResourceMap", () => {
  it("应该支持 set/get 基本操作", () => {
    const resources = createResourceMap()
    const key = createResourceKey<TestModel>("test.model")

    const model: TestModel = { name: "test", value: 42 }
    resources.set(key, model)

    const result = resources.get(key)
    expect(result).toBe(model)
    expect(result?.name).toBe("test")
    expect(result?.value).toBe(42)
  })

  it("应该返回 undefined 如果资源不存在", () => {
    const resources = createResourceMap()
    const key = createResourceKey<TestModel>("test.model")

    const result = resources.get(key)
    expect(result).toBeUndefined()
  })

  it("应该支持 delete 删除资源", () => {
    const resources = createResourceMap()
    const key = createResourceKey<TestModel>("test.model")

    const model: TestModel = { name: "test", value: 42 }
    resources.set(key, model)

    expect(resources.get(key)).toBe(model)

    resources.delete(key)

    expect(resources.get(key)).toBeUndefined()
  })

  it("应该支持 clear 清空所有资源", () => {
    const resources = createResourceMap()
    const key1 = createResourceKey<TestModel>("test.model1")
    const key2 = createResourceKey<TestModel>("test.model2")

    resources.set(key1, { name: "model1", value: 1 })
    resources.set(key2, { name: "model2", value: 2 })

    expect(resources.get(key1)).toBeDefined()
    expect(resources.get(key2)).toBeDefined()

    resources.clear()

    expect(resources.get(key1)).toBeUndefined()
    expect(resources.get(key2)).toBeUndefined()
  })
})

describe("require method", () => {
  it("应该在资源存在时返回正确值", () => {
    const resources = createResourceMap()
    const key = createResourceKey<TestModel>("test.model")

    const model: TestModel = { name: "test", value: 42 }
    resources.set(key, model)

    const result = resources.require(key)
    expect(result).toBe(model)
  })

  it("应该在资源不存在时抛出明确错误", () => {
    const resources = createResourceMap()
    const key = createResourceKey<TestModel>("test.model")

    expect(() => resources.require(key)).toThrow("Missing runtime resource: test.model")
  })
})

describe("type safety", () => {
  it("应该支持不同类型的资源", () => {
    const resources = createResourceMap()

    interface ModelA {
      type: "A"
      value: string
    }

    interface ModelB {
      type: "B"
      count: number
    }

    const keyA = createResourceKey<ModelA>("model.A")
    const keyB = createResourceKey<ModelB>("model.B")

    resources.set(keyA, { type: "A", value: "test" })
    resources.set(keyB, { type: "B", count: 42 })

    const resultA = resources.get(keyA)
    const resultB = resources.get(keyB)

    expect(resultA?.type).toBe("A")
    expect(resultB?.type).toBe("B")
  })
})
