import { describe, expect, it, vi } from "vitest"

import { createRawFieldSchema, createRuntimeGraphHarness } from "./runtimeGraphTestUtils"

import type { FieldRuntimeNode } from "../runtimeNode"

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
    const { commitSchemas, root } = createRuntimeGraphHarness(hooks)

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const node = root.childNodes[0] as FieldRuntimeNode
    const previousDescriptor = node.descriptor

    commitSchemas(root, [createRawFieldSchema("name", "nickname")])

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
      descriptor: previousDescriptor,
    })
    expect(updatePreviousRuntimeNode).toBe(beforeUpdatePreviousRuntimeNode)
    expect(updatedPreviousRuntimeNode).toBe(beforeUpdatePreviousRuntimeNode)
    expect(beforeUpdatePreviousRuntimeNode).not.toBe(previousDescriptor)
  })

  it("disposed field 保留 descriptor 和 model 快照但释放资源 scope", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes[0] as FieldRuntimeNode
    const descriptor = field.descriptor
    const model = field.fieldModel

    commitSchemas(root, [])

    expect(field.disposed.value).toBe(true)
    expect(field.descriptor).toBe(descriptor)
    expect(field.fieldModel).toBe(model)
    expect(field.fieldResourceScope).toBeNull()
    expect(field.fieldDependenciesScope).toBeNull()
  })
})
