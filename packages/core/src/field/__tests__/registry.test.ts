/**
 * FieldRegistry 模块测试。
 *
 * @module core/field/__tests__/fieldRegistry.test
 */

import { describe, expect, it } from "vitest"

import {
  createTestFieldFiber,
  createTestRootFiber,
} from "../../graph/__tests__/fiberTestUtils"
import { createFieldModel } from "../model"
import { createFieldRegistry } from "../registry"

import type { FieldDescriptor } from "../../descriptor/descriptor"

const createDescriptor = (name: string): FieldDescriptor => ({
  type: "field",
  key: `field-${name}`,
  schema: {
    name,
    componentType: "input",
  },
})

const createEntry = (name: string) => {
  const descriptor = createDescriptor(name)
  const root = createTestRootFiber()
  const fiber = createTestFieldFiber({ key: descriptor.key, parent: root, descriptor })
  const model = createFieldModel(descriptor)

  return { name, fiber, descriptor, model }
}

describe("createFieldRegistry", () => {
  it("应该创建空 Registry", () => {
    const registry = createFieldRegistry()

    expect(registry.list()).toEqual([])
  })

  it("应该按 descriptor.name 注册字段 entry", () => {
    const registry = createFieldRegistry()
    const entry = createEntry("field1")

    registry.register(entry)

    expect(registry.get("field1" as any)).toBe(entry)
  })

  it("应该支持嵌套与字符串 name path 查询", () => {
    const registry = createFieldRegistry()
    const entry = createEntry("user.name")

    registry.register(entry)

    expect(registry.get("user.name" as any)).toBe(entry)
    expect(registry.get("not-exist" as any)).toBeUndefined()
  })
})

describe("list and unregister", () => {
  it("应该列出所有字段 entry", () => {
    const registry = createFieldRegistry()
    const entry1 = createEntry("field1")
    const entry2 = createEntry("field2")

    registry.register(entry1)
    registry.register(entry2)

    expect(registry.list()).toEqual([entry1, entry2])
  })

  it("应该按 name 注销字段 entry", () => {
    const registry = createFieldRegistry()
    const entry = createEntry("field1")

    registry.register(entry)
    registry.unregister("field1" as any)

    expect(registry.get("field1" as any)).toBeUndefined()
    expect(registry.list()).toEqual([])
  })

  it("旧 fiber 注销时不会移除同名新 fiber 的注册项", () => {
    const registry = createFieldRegistry()
    const oldEntry = createEntry("user.name")
    const root = createTestRootFiber()
    const descriptor = createDescriptor("user.name")
    const newEntry = {
      ...createEntry("user.name"),
      fiber: createTestFieldFiber({
        id: 2,
        key: "new-field",
        parent: root,
        descriptor,
      }),
    }

    registry.register(oldEntry)
    registry.register(newEntry)
    registry.unregister("user.name" as any, oldEntry.fiber)

    expect(registry.get("user.name" as any)).toBe(newEntry)
  })
})
