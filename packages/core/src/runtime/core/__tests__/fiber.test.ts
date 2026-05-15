/**
 * Fiber 模块测试。
 *
 * @module core/runtime/core/__tests__/fiber.test
 */

import { describe, expect, it } from "vitest"

import { createFiber, disposeFiber } from "../fiber"

import type { Fiber } from "../fiber"

describe("createFiber", () => {
  it("应该创建空的 Fiber", () => {
    const fiber = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    expect(fiber.id).toBe(1)
    expect(fiber.key).toBe("root")
    expect(fiber.kind).toBe("root")
    expect(fiber.parent).toBeNull()
    expect(fiber.children).toEqual([])
    expect(fiber.disposed.value).toBe(false)
    expect(fiber.scope).toBeDefined()
    expect(fiber.resources).toBeDefined()
  })

  it("应该创建带 parent 的 Fiber", () => {
    const parent = createFiber({
      id: 1,
      key: "parent",
      kind: "root",
    })

    const child = createFiber({
      id: 2,
      key: "child",
      kind: "field",
      parent,
    })

    expect(child.parent).toBe(parent)
    expect(child.id).toBe(2)
    expect(child.key).toBe("child")
    expect(child.kind).toBe("field")
  })

  it("应该创建带自定义 scope 的 Fiber", () => {
    const parent = createFiber({
      id: 1,
      key: "parent",
      kind: "root",
    })

    const childScope = parent.scope.child()
    const child = createFiber({
      id: 2,
      key: "child",
      kind: "field",
      parent,
      scope: childScope,
    })

    expect(child.scope).toBe(childScope)
  })
})

describe("disposeFiber", () => {
  it("应该 dispose 单个 Fiber", () => {
    const fiber = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    expect(fiber.disposed.value).toBe(false)

    disposeFiber(fiber)

    expect(fiber.disposed.value).toBe(true)
    expect(fiber.children).toEqual([])
    expect(fiber.parent).toBeNull()
  })

  it("应该按先子后父顺序 dispose 多层级子树", () => {
    const root = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    const child1 = createFiber({
      id: 2,
      key: "child1",
      kind: "field",
      parent: root,
    })

    const child2 = createFiber({
      id: 3,
      key: "child2",
      kind: "field",
      parent: root,
    })

    const grandchild = createFiber({
      id: 4,
      key: "grandchild",
      kind: "field",
      parent: child1,
    })

    root.children = [child1, child2]
    child1.children = [grandchild]

    // 记录 dispose 顺序
    const disposeOrder: string[] = []
    child1.scope.add(() => disposeOrder.push("child1"))
    child2.scope.add(() => disposeOrder.push("child2"))
    grandchild.scope.add(() => disposeOrder.push("grandchild"))
    root.scope.add(() => disposeOrder.push("root"))

    disposeFiber(root)

    // 验证 dispose 顺序：先子后父
    expect(disposeOrder).toEqual(["grandchild", "child1", "child2", "root"])

    // 验证所有节点都已 disposed
    expect(root.disposed.value).toBe(true)
    expect(child1.disposed.value).toBe(true)
    expect(child2.disposed.value).toBe(true)
    expect(grandchild.disposed.value).toBe(true)
  })

  it("应该幂等 dispose", () => {
    const fiber = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    disposeFiber(fiber)
    expect(fiber.disposed.value).toBe(true)

    // 再次 dispose 应该不执行任何操作
    disposeFiber(fiber)
    expect(fiber.disposed.value).toBe(true)
  })

  it("应该在 dispose 后清空 children、resources、scope", () => {
    const fiber = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    const child = createFiber({
      id: 2,
      key: "child",
      kind: "field",
      parent: fiber,
    })

    fiber.children = [child]

    // 注册 cleanup
    let cleanupCalled = false
    fiber.scope.add(() => {
      cleanupCalled = true
    })

    disposeFiber(fiber)

    expect(fiber.children).toEqual([])
    expect(fiber.parent).toBeNull()
    expect(fiber.disposed.value).toBe(true)
    expect(cleanupCalled).toBe(true)
  })
})
