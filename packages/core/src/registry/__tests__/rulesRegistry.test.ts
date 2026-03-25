/**
 * RulesRegistry 校验规则注册中心单元测试
 *
 * 覆盖 register、registerAll、getRule、resolve、hasRule、unregister、
 * getNames、clear、size，以及父子链式查找、override 选项、
 * createLocalRuleRegistry、defineRule、defineRules。
 *
 * @module registry/__tests__/rulesRegistry
 */
import { describe, expect, it } from "vitest"

import {
  createLocalRuleRegistry,
  defineRule,
  defineRules,
  RulesRegistry,
  rulesRegistry,
} from "../rulesRegistry"

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

  describe("父子链式查找", () => {
    it("getRule 委托父级查找", () => {
      const parent = new RulesRegistry()
      const schema = createMockSchema("parent-rule")
      parent.register("phone", schema)

      const child = new RulesRegistry(parent)
      expect(child.getRule("phone")).toBe(schema)
    })

    it("resolve 委托父级解析", () => {
      const parent = new RulesRegistry()
      const schema = createMockSchema("parent-rule")
      parent.register("phone", schema)

      const child = new RulesRegistry(parent)
      expect(child.resolve("phone")).toBe(schema)
    })

    it("hasRule 检查父级", () => {
      const parent = new RulesRegistry()
      parent.register("phone", createMockSchema("phone"))

      const child = new RulesRegistry(parent)
      expect(child.hasRule("phone")).toBe(true)
    })
  })
})

describe("createLocalRuleRegistry", () => {
  it("返回带父级链的 RulesRegistry 实例", () => {
    const parent = new RulesRegistry()
    parent.register("phone", createMockSchema("phone"))

    const local = createLocalRuleRegistry(parent)
    expect(local).toBeInstanceOf(RulesRegistry)
    expect(local.hasRule("phone")).toBe(true)
  })
})

describe("defineRule", () => {
  it("注册到全局并返回原值", () => {
    const schema = createMockSchema("test-define")
    const result = defineRule("test-define-rule", schema)
    expect(result).toBe(schema)
    expect(rulesRegistry.getRule("test-define-rule")).toBe(schema)

    // 清理
    rulesRegistry.unregister("test-define-rule")
  })
})

describe("defineRules", () => {
  it("批量注册到全局并返回原映射", () => {
    const s1 = createMockSchema("a")
    const s2 = createMockSchema("b")
    const map = { "test-bulk-a": s1, "test-bulk-b": s2 }
    const result = defineRules(map)
    expect(result).toBe(map)
    expect(rulesRegistry.getRule("test-bulk-a")).toBe(s1)
    expect(rulesRegistry.getRule("test-bulk-b")).toBe(s2)

    // 清理
    rulesRegistry.unregister("test-bulk-a")
    rulesRegistry.unregister("test-bulk-b")
  })
})
