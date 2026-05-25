import { describe, expect, it, vi } from "vitest"

import { createRawFieldSchema, createRuntimeGraphHarness } from "./runtimeGraphTestUtils"

import type { FieldFiber } from "../fiber"

describe("fiber lifecycle flow", () => {
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

  it("disposed field 保留 descriptor 和 model 快照但释放资源 scope", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childFibers[0] as FieldFiber
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
