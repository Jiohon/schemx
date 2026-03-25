/**
 * schema 列配置工具单元测试
 *
 * 覆盖 isBaseSchema、isGroupSchema、isDependencySchema 类型守卫
 * 和 findSchema 递归查找。
 *
 * @module utils/__tests__/schema
 */
import { describe, expect, it } from "vitest"

import { findSchema, isBaseSchema, isDependencySchema, isGroupSchema } from "../schema"

import type { SchemxField } from "../../types"

const baseField: SchemxField = {
  name: "username",
  componentType: "text" as any,
} as any

const groupField: SchemxField = {
  componentType: "group",
  label: "基本信息",
  children: [baseField],
} as any

const dependencyField: SchemxField = {
  componentType: "dependency",
  dependencies: ["username"],
  children: () => [],
} as any

describe("isBaseSchema", () => {
  it("基础字段配置返回 true", () => {
    expect(isBaseSchema(baseField)).toBe(true)
  })

  it("group 类型返回 false", () => {
    expect(isBaseSchema(groupField)).toBe(false)
  })

  it("dependency 类型返回 false", () => {
    expect(isBaseSchema(dependencyField)).toBe(false)
  })
})

describe("isGroupSchema", () => {
  it("group 类型返回 true", () => {
    expect(isGroupSchema(groupField)).toBe(true)
  })

  it("非 group 类型返回 false", () => {
    expect(isGroupSchema(baseField)).toBe(false)
    expect(isGroupSchema(dependencyField)).toBe(false)
  })
})

describe("isDependencySchema", () => {
  it("dependency 类型返回 true", () => {
    expect(isDependencySchema(dependencyField)).toBe(true)
  })

  it("非 dependency 类型返回 false", () => {
    expect(isDependencySchema(baseField)).toBe(false)
    expect(isDependencySchema(groupField)).toBe(false)
  })
})

describe("findSchema", () => {
  it("平铺 schemas 中按名称查找", () => {
    const schemas: SchemxField[] = [baseField]
    expect(findSchema(schemas, "username")).toBe(baseField)
  })

  it("group 嵌套中递归查找", () => {
    const schemas: SchemxField[] = [groupField]
    expect(findSchema(schemas, "username")).toBe(baseField)
  })

  it("不存在的字段名返回 undefined", () => {
    const schemas: SchemxField[] = [baseField, groupField]
    expect(findSchema(schemas, "nonexistent")).toBeUndefined()
  })
})
