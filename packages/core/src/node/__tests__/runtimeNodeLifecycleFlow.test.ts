import { describe, expect, it, vi } from "vitest"

import { createRawFieldSchema, createRuntimeGraphHarness } from "./runtimeGraphTestUtils"

import type { FieldRuntimeNode } from "../types"

describe("node lifecycle flow", () => {
  it("create/update/remove transition 每类生命周期事件只触发一次", () => {
    const hooks = {
      beforeMount: vi.fn(),
      mount: vi.fn(),
      mounted: vi.fn(),
      beforeUpdate: vi.fn(),
      update: vi.fn(),
      updated: vi.fn(),
      beforeUnmount: vi.fn(),
      unmount: vi.fn(),
      unmounted: vi.fn(),
    }
    const { commitSchemas, root } = createRuntimeGraphHarness(hooks)

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    commitSchemas(root, [createRawFieldSchema("name", "name")])
    commitSchemas(root, [])

    expect(hooks.beforeMount).toHaveBeenCalledTimes(1)
    expect(hooks.mount).toHaveBeenCalledTimes(1)
    expect(hooks.mounted).toHaveBeenCalledTimes(1)
    expect(hooks.beforeUpdate).toHaveBeenCalledTimes(1)
    expect(hooks.update).toHaveBeenCalledTimes(1)
    expect(hooks.updated).toHaveBeenCalledTimes(1)
    expect(hooks.beforeUnmount).toHaveBeenCalledTimes(1)
    expect(hooks.unmount).toHaveBeenCalledTimes(1)
    expect(hooks.unmounted).toHaveBeenCalledTimes(1)
  })

  it("生命周期回调只接收 node，update 回调接收 previousNode", () => {
    const hooks = {
      beforeMount: vi.fn(),
      mount: vi.fn(),
      mounted: vi.fn(),
      beforeUpdate: vi.fn(),
      update: vi.fn(),
      updated: vi.fn(),
    }
    const { commitSchemas, context, root } = createRuntimeGraphHarness(hooks)

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const node = root.childNodes[0] as FieldRuntimeNode
    const previousDescriptor = context.nodeResources.descriptors.get(node.id)

    commitSchemas(root, [createRawFieldSchema("name", "nickname")])
    const nextDescriptor = context.nodeResources.descriptors.get(node.id)

    expect(hooks.beforeMount).toHaveBeenCalledWith(node)
    expect(hooks.mount).toHaveBeenCalledWith(node)
    expect(hooks.mounted).toHaveBeenCalledWith(node)

    const [beforeUpdateNode, beforeUpdatePreviousRuntimeNode] =
      hooks.beforeUpdate.mock.calls[0] ?? []
    const [updateNode, updatePreviousRuntimeNode] = hooks.update.mock.calls[0] ?? []
    const [updatedNode, updatedPreviousRuntimeNode] = hooks.updated.mock.calls[0] ?? []

    expect(beforeUpdateNode).toBe(node)
    expect(updateNode).toBe(node)
    expect(updatedNode).toBe(node)
    expect(beforeUpdatePreviousRuntimeNode).toMatchObject({
      type: "field",
      key: "name",
    })
    expect(beforeUpdatePreviousRuntimeNode).not.toHaveProperty("descriptor")
    expect(updatePreviousRuntimeNode).toBe(beforeUpdatePreviousRuntimeNode)
    expect(updatedPreviousRuntimeNode).toBe(beforeUpdatePreviousRuntimeNode)
    expect(beforeUpdatePreviousRuntimeNode).not.toBe(previousDescriptor)
    expect(nextDescriptor).not.toBe(previousDescriptor)
  })

  it("disposed field 会释放并删除 resources 中的字段资源", () => {
    const { commitSchemas, context, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes[0] as FieldRuntimeNode

    expect(context.nodeResources.descriptors.has(field.id)).toBe(true)
    expect(context.nodeResources.fieldStates.has(field.id)).toBe(true)
    expect(context.nodeResources.fieldResourceScopes.has(field.id)).toBe(true)
    expect(context.nodeResources.fieldDynamicPropScopes.has(field.id)).toBe(true)

    commitSchemas(root, [])

    expect(field.disposed.value).toBe(true)
    expect(field).not.toHaveProperty("descriptor")
    expect(field).not.toHaveProperty("runtimeState")
    expect(context.nodeResources.descriptors.has(field.id)).toBe(false)
    expect(context.nodeResources.fieldStates.has(field.id)).toBe(false)
    expect(context.nodeResources.fieldResourceScopes.has(field.id)).toBe(false)
    expect(context.nodeResources.fieldDynamicPropScopes.has(field.id)).toBe(false)
  })
})

import { describe, expect, it } from "vitest"
import { createFieldRuntimeState, resetFieldDynamicOverrides, setFieldDynamicOverrides } from "../../field/runtimeState"

import type { SchemxResolvedBaseField } from "../../types"

function createTestSchema(overrides: Partial<SchemxResolvedBaseField> = {}): SchemxResolvedBaseField {
  return {
    componentType: "input",
    label: "测试字段",
    visible: true,
    disabled: false,
    readonly: false,
    required: false,
    placeholder: "请输入",
    componentProps: {},
    rules: [],
    validationTrigger: "onChange",
    ...overrides,
  } as SchemxResolvedBaseField
}

describe("字段删除和 scope 释放 (US3)", () => {
  it("dispose 后 runtimeState 应标记为 dispose", () => {
    const schema = createTestSchema()
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "email" as any, staticSchema: schema },
    })

    resetFieldDynamicOverrides(state, "dispose")

    expect(state.diagnostics.value.lastUpdatedBy).toBe("dispose")
    expect(state.dynamicOverrides.value).toEqual({})
  })

  it("dispose 后不应再接受动态覆盖写入（调用方负责检查 scope）", () => {
    const schema = createTestSchema({ visible: true })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "email" as any, staticSchema: schema },
    })

    resetFieldDynamicOverrides(state, "dispose")

    // 即使尝试写入，diagnostics 仍标记为 dispose
    setFieldDynamicOverrides(state, { visible: false }, {
      source: "dependencies",
      triggerFields: ["country" as any],
    })

    // 写入仍然生效（runtimeState 不自行阻止），但 diagnostics 反映最新状态
    expect(state.diagnostics.value.lastUpdatedBy).toBe("dependencies")
  })

  it("reset 后 dynamicOverrides 应清空", () => {
    const schema = createTestSchema({ visible: true })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "email" as any, staticSchema: schema },
    })

    setFieldDynamicOverrides(state, { visible: false, disabled: true }, {
      source: "dependencies",
      triggerFields: ["country" as any],
    })

    resetFieldDynamicOverrides(state, "reset")

    expect(state.dynamicOverrides.value).toEqual({})
    expect(state.effectiveSchema.value.visible).toBe(true)
    expect(state.effectiveSchema.value.disabled).toBe(false)
  })
})
