/**
 * Reconciler 模块测试。
 *
 * @module core/runtime/core/__tests__/reconciler.test
 */

import { describe, expect, it, vi } from "vitest"

import { createFiber } from "../fiber"
import { createReconciler } from "../reconciler"

import type { Fiber } from "../fiber"
import type { ReconcileHooks, RuntimeDescriptor } from "../reconciler"

describe("reconcileChildren", () => {
  it("应该 reconcile 空父节点的第一个子节点列表", () => {
    const parent = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    const reconciler = createReconciler()

    const hooks: ReconcileHooks = {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    }

    const descriptors: RuntimeDescriptor[] = [
      { key: "field1", kind: "field" },
      { key: "field2", kind: "field" },
    ]

    const children = reconciler.reconcileChildren(
      parent,
      parent.children,
      descriptors,
      hooks
    )

    expect(children).toHaveLength(2)
    expect(children[0].key).toBe("field1")
    expect(children[1].key).toBe("field2")
    expect(hooks.mount).toHaveBeenCalledTimes(2)
    expect(hooks.update).not.toHaveBeenCalled()
    expect(hooks.unmount).not.toHaveBeenCalled()
  })

  it("应该调用 mount hook", () => {
    const parent = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    const reconciler = createReconciler()

    const mountHook = vi.fn()
    const hooks: ReconcileHooks = {
      mount: mountHook,
      update: vi.fn(),
      unmount: vi.fn(),
    }

    const descriptors: RuntimeDescriptor[] = [
      { key: "field1", kind: "field", data: { name: "test" } },
    ]

    reconciler.reconcileChildren(parent, parent.children, descriptors, hooks)

    expect(mountHook).toHaveBeenCalledTimes(1)
    expect(mountHook).toHaveBeenCalledWith(
      expect.objectContaining({ key: "field1" }),
      descriptors[0]
    )
  })
})

describe("keyed reuse", () => {
  it("应该在同 key 同 kind 时复用，调用 update hook", () => {
    const parent = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    const reconciler = createReconciler()

    // 第一次 reconcile
    const hooks1: ReconcileHooks = {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    }

    const descriptors1: RuntimeDescriptor[] = [
      { key: "field1", kind: "field" },
      { key: "field2", kind: "field" },
    ]

    const children1 = reconciler.reconcileChildren(parent, [], descriptors1, hooks1)

    expect(hooks1.mount).toHaveBeenCalledTimes(2)

    // 第二次 reconcile，复用同 key 同 kind 的节点
    const hooks2: ReconcileHooks = {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    }

    const descriptors2: RuntimeDescriptor[] = [
      { key: "field1", kind: "field", data: { updated: true } },
      { key: "field2", kind: "field" },
    ]

    const children2 = reconciler.reconcileChildren(
      parent,
      children1,
      descriptors2,
      hooks2
    )

    // 应该复用而不是创建新节点
    expect(children2[0]).toBe(children1[0])
    expect(children2[1]).toBe(children1[1])
    expect(hooks2.update).toHaveBeenCalledTimes(2)
    expect(hooks2.mount).not.toHaveBeenCalled()
    expect(hooks2.unmount).not.toHaveBeenCalled()
  })

  it("应该在同 key 不同 kind 时替换节点", () => {
    const parent = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    const reconciler = createReconciler()

    // 第一次 reconcile
    const hooks1: ReconcileHooks = {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    }

    const descriptors1: RuntimeDescriptor[] = [{ key: "node1", kind: "field" }]

    const children1 = reconciler.reconcileChildren(parent, [], descriptors1, hooks1)

    // 第二次 reconcile，同 key 不同 kind
    const hooks2: ReconcileHooks = {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    }

    const descriptors2: RuntimeDescriptor[] = [{ key: "node1", kind: "group" }]

    const children2 = reconciler.reconcileChildren(
      parent,
      children1,
      descriptors2,
      hooks2
    )

    // 应该创建新节点，不是复用
    expect(children2[0]).not.toBe(children1[0])
    expect(children2[0].kind).toBe("group")
    expect(hooks2.unmount).toHaveBeenCalledTimes(1)
    expect(hooks2.mount).toHaveBeenCalledTimes(1)
    expect(hooks2.update).not.toHaveBeenCalled()
  })
})

describe("reorder", () => {
  it("应该在子节点顺序变化时正确复用", () => {
    const parent = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    const reconciler = createReconciler()

    // 第一次 reconcile
    const hooks1: ReconcileHooks = {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    }

    const descriptors1: RuntimeDescriptor[] = [
      { key: "a", kind: "field" },
      { key: "b", kind: "field" },
      { key: "c", kind: "field" },
    ]

    const children1 = reconciler.reconcileChildren(parent, [], descriptors1, hooks1)

    // 第二次 reconcile，顺序变化
    const hooks2: ReconcileHooks = {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    }

    const descriptors2: RuntimeDescriptor[] = [
      { key: "c", kind: "field" },
      { key: "a", kind: "field" },
      { key: "b", kind: "field" },
    ]

    const children2 = reconciler.reconcileChildren(
      parent,
      children1,
      descriptors2,
      hooks2
    )

    // 应该复用而不是创建新节点
    expect(children2[0]).toBe(children1[2]) // c
    expect(children2[1]).toBe(children1[0]) // a
    expect(children2[2]).toBe(children1[1]) // b
    expect(hooks2.update).toHaveBeenCalledTimes(3)
    expect(hooks2.mount).not.toHaveBeenCalled()
    expect(hooks2.unmount).not.toHaveBeenCalled()
  })
})

describe("removal", () => {
  it("应该在移除节点时调用 unmount hook", () => {
    const parent = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    const reconciler = createReconciler()

    // 第一次 reconcile
    const hooks1: ReconcileHooks = {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    }

    const descriptors1: RuntimeDescriptor[] = [
      { key: "a", kind: "field" },
      { key: "b", kind: "field" },
      { key: "c", kind: "field" },
    ]

    const children1 = reconciler.reconcileChildren(parent, [], descriptors1, hooks1)

    // 第二次 reconcile，移除 b
    const hooks2: ReconcileHooks = {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    }

    const descriptors2: RuntimeDescriptor[] = [
      { key: "a", kind: "field" },
      { key: "c", kind: "field" },
    ]

    const children2 = reconciler.reconcileChildren(
      parent,
      children1,
      descriptors2,
      hooks2
    )

    expect(children2).toHaveLength(2)
    expect(hooks2.unmount).toHaveBeenCalledTimes(1)
    expect(hooks2.unmount).toHaveBeenCalledWith(children1[1]) // b
  })

  it("应该在移除节点时调用 disposeFiber", () => {
    const parent = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    const reconciler = createReconciler()

    // 第一次 reconcile
    const descriptors1: RuntimeDescriptor[] = [{ key: "a", kind: "field" }]

    const children1 = reconciler.reconcileChildren(parent, [], descriptors1, {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    })

    // 第二次 reconcile，移除 a
    const descriptors2: RuntimeDescriptor[] = []

    reconciler.reconcileChildren(parent, children1, descriptors2, {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    })

    // 验证节点已被 dispose
    expect(children1[0].disposed.value).toBe(true)
  })
})
