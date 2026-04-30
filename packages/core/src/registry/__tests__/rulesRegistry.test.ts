/**
 * RulesRegistry 校验规则注册中心单元测试
 *
 * 覆盖 register、registerAll、getRule、resolve、hasRule、unregister、
 * getNames、clear、size，以及 override 选项和 createRulesRegistry。
 *
 * @module registry/__tests__/rulesRegistry
 */
import { describe, expect, it } from "vitest"

import { createRulesRegistry, RulesRegistry } from "../rulesRegistry"

import type { StandardSchemaV1 } from "../../types/standardSchema"

/** 创建一个简单的测试用 StandardSchemaV1 实例 */
const createMockSchema = (_msg: string): StandardSchemaV1 => ({
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value: unknown) => ({ value }),
  },
})

describe("RulesRegistry", () => {
  describe("register / getRule", () => {
    it("注册 StandardSchemaV1 实例后 getRule 返回该实例", () => {
      const reg = new RulesRegistry()
      const schema = createMockSchema("test")
      reg.register("phone", schema)
      expect(reg.getRule("phone")).toBe(schema)
    })

    it("注册工厂函数后 getRule 返回该工厂函数", () => {
      const reg = new RulesRegistry()
      const factory = () => createMockSchema("required")
      reg.register("required", factory)
      expect(reg.getRule("required")).toBe(factory)
    })

    it("override: false 不覆盖已存在的规则", () => {
      const reg = new RulesRegistry()
      const schema1 = createMockSchema("first")
      const schema2 = createMockSchema("second")
      reg.register("phone", schema1)
      reg.register("phone", schema2, { override: false })
      expect(reg.getRule("phone")).toBe(schema1)
    })

    it("默认覆盖已存在的规则", () => {
      const reg = new RulesRegistry()
      const schema1 = createMockSchema("first")
      const schema2 = createMockSchema("second")
      reg.register("phone", schema1)
      reg.register("phone", schema2)
      expect(reg.getRule("phone")).toBe(schema2)
    })
  })

  describe("registerAll", () => {
    it("批量注册多个规则", () => {
      const reg = new RulesRegistry()
      const s1 = createMockSchema("a")
      const s2 = createMockSchema("b")
      reg.registerAll({ phone: s1, email: s2 })
      expect(reg.size()).toBe(2)
      expect(reg.getRule("phone")).toBe(s1)
      expect(reg.getRule("email")).toBe(s2)
    })
  })

  describe("resolve", () => {
    it("注册的是固定实例时直接返回", () => {
      const reg = new RulesRegistry()
      const schema = createMockSchema("phone")
      reg.register("phone", schema)
      expect(reg.resolve("phone")).toBe(schema)
    })

    it("注册的是工厂函数时调用并返回结果", () => {
      const reg = new RulesRegistry()
      const mockResult = createMockSchema("required")
      const factory = () => mockResult
      reg.register("required", factory)
      expect(reg.resolve("required")).toBe(mockResult)
    })

    it("未注册的规则返回 undefined", () => {
      const reg = new RulesRegistry()
      expect(reg.resolve("nonexistent")).toBeUndefined()
    })
  })

  describe("hasRule / unregister / getNames / clear / size", () => {
    it("hasRule 检查规则是否存在", () => {
      const reg = new RulesRegistry()
      reg.register("phone", createMockSchema("phone"))
      expect(reg.hasRule("phone")).toBe(true)
      expect(reg.hasRule("email")).toBe(false)
    })

    it("unregister 移除规则返回 true，不存在返回 false", () => {
      const reg = new RulesRegistry()
      reg.register("phone", createMockSchema("phone"))
      expect(reg.unregister("phone")).toBe(true)
      expect(reg.unregister("phone")).toBe(false)
    })

    it("getNames 返回所有已注册规则名称", () => {
      const reg = new RulesRegistry()
      reg.register("phone", createMockSchema("phone"))
      reg.register("email", createMockSchema("email"))
      expect(reg.getNames()).toEqual(expect.arrayContaining(["phone", "email"]))
    })

    it("clear 清除所有规则且 size 返回 0", () => {
      const reg = new RulesRegistry()
      reg.register("phone", createMockSchema("phone"))
      reg.register("email", createMockSchema("email"))
      reg.clear()
      expect(reg.size()).toBe(0)
    })
  })
})

describe("createRulesRegistry", () => {
  it("返回 RulesRegistry 实例", () => {
    const reg = createRulesRegistry()
    expect(reg).toBeInstanceOf(RulesRegistry)
    expect(reg.size()).toBe(0)
  })
})
