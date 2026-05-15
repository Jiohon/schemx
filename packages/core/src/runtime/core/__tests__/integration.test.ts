/**
 * Runtime Core Kernel 集成测试。
 *
 * @module core/runtime/core/__tests__/integration.test
 */

import { describe, expect, it, vi } from "vitest"

import { createFiber, disposeFiber } from "../fiber"
import { createReconciler } from "../reconciler"
import { createRuntimeScope } from "../scope"
import { createRuntimeScheduler } from "../scheduler"

import type { ReconcileHooks, RuntimeDescriptor } from "../reconciler"

describe("integration: fiber tree reconcile dispose", () => {
  it("应该完成完整的 fiber 树生命周期", async () => {
    // 1. 创建 root fiber
    const root = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    // 2. 创建 reconciler
    const reconciler = createReconciler()

    // 3. 第一次 reconcile：创建子节点
    const hooks1: ReconcileHooks = {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    }

    const descriptors1: RuntimeDescriptor[] = [
      { key: "field1", kind: "field" },
      { key: "field2", kind: "field" },
      { key: "group1", kind: "group" },
    ]

    const children1 = reconciler.reconcileChildren(
      root,
      root.children,
      descriptors1,
      hooks1
    )

    expect(children1).toHaveLength(3)
    // Reconciler 不递归处理 children，所以只有 3 次 mount
    expect(hooks1.mount).toHaveBeenCalledTimes(3)
    expect(root.children).toBe(children1)

    // 4. 第二次 reconcile：更新和移除
    const hooks2: ReconcileHooks = {
      mount: vi.fn(),
      update: vi.fn(),
      unmount: vi.fn(),
    }

    const descriptors2: RuntimeDescriptor[] = [
      { key: "field1", kind: "field" }, // 复用
      { key: "group1", kind: "group", children: [{ key: "field3", kind: "field" }] }, // 移除 field4
    ]

    const children2 = reconciler.reconcileChildren(root, children1, descriptors2, hooks2)

    expect(children2).toHaveLength(2)
    expect(hooks2.update).toHaveBeenCalled() // field1, group1, field3
    expect(hooks2.unmount).toHaveBeenCalled() // field2, field4

    // 5. Dispose 整棵树
    disposeFiber(root)

    expect(root.disposed.value).toBe(true)
    expect(children2[0].disposed.value).toBe(true)
    expect(children2[1].disposed.value).toBe(true)
    expect(root.children).toEqual([])
  })

  it("应该支持嵌套 dynamic slot 模式", async () => {
    // 1. 创建 root fiber
    const root = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    // 2. 创建 reconciler
    const reconciler = createReconciler()

    // 3. 第一次 reconcile：创建 slot
    const hooks1: ReconcileHooks = {
      mount: (fiber, descriptor) => {
        // 如果是 slot，创建子节点
        if (descriptor.kind === "slot" && descriptor.children) {
          reconciler.reconcileChildren(fiber, [], descriptor.children, {
            mount: vi.fn(),
            update: vi.fn(),
            unmount: vi.fn(),
          })
        }
      },
      update: vi.fn(),
      unmount: vi.fn(),
    }

    const descriptors1: RuntimeDescriptor[] = [
      {
        key: "slot1",
        kind: "slot",
        children: [
          { key: "dynamic-field1", kind: "field" },
          { key: "dynamic-field2", kind: "field" },
        ],
      },
    ]

    const children1 = reconciler.reconcileChildren(
      root,
      root.children,
      descriptors1,
      hooks1
    )

    expect(children1).toHaveLength(1)
    expect(children1[0].key).toBe("slot1")
    expect(children1[0].kind).toBe("slot")
  })
})

describe("integration: scheduler with scope", () => {
  it("应该支持 scope 级任务取消", async () => {
    const scheduler = createRuntimeScheduler()
    const scope = createRuntimeScope()

    const executedTasks: string[] = []

    // 注册任务
    scheduler.schedule({
      id: "task-1",
      priority: "normal",
      scope,
      run: () => executedTasks.push("task-1"),
    })

    scheduler.schedule({
      id: "task-2",
      priority: "normal",
      scope,
      run: () => executedTasks.push("task-2"),
    })

    // 在 flush 前释放 scope
    scope.dispose()

    await scheduler.flush()

    // 所有任务应该被取消
    expect(executedTasks).toEqual([])
  })

  it("应该支持 fiber 级 scheduler 生命周期", async () => {
    // 1. 创建 fiber 和 scheduler
    const fiber = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    const scheduler = createRuntimeScheduler()

    // 2. 注册 cleanup 到 fiber scope
    fiber.scope.add(() => {
      scheduler.dispose()
    })

    // 3. 调度任务
    const task = vi.fn()
    scheduler.schedule({
      id: "task-1",
      priority: "normal",
      run: task,
    })

    await scheduler.flush()
    expect(task).toHaveBeenCalledTimes(1)

    // 4. Dispose fiber
    disposeFiber(fiber)

    // 5. Scheduler 应该被 dispose
    scheduler.schedule({
      id: "task-2",
      priority: "normal",
      run: vi.fn(),
    })

    await scheduler.flush()
    // task-2 不应该执行
  })
})

describe("integration: resource lifecycle", () => {
  it("应该支持通过 ResourceMap 管理领域模型", () => {
    // 1. 创建 fiber
    const fiber = createFiber({
      id: 1,
      key: "root",
      kind: "root",
    })

    // 2. 定义资源 key
    const MODEL_KEY = Symbol("test.model")

    // 3. 创建领域模型
    const model = {
      name: "test",
      dispose: vi.fn(),
    }

    // 4. 挂载模型到 fiber
    fiber.resources.set({ id: MODEL_KEY, description: "test.model" }, model)

    // 5. 获取模型
    const retrieved = fiber.resources.get({
      id: MODEL_KEY,
      description: "test.model",
    })
    expect(retrieved).toBe(model)

    // 6. 注册 cleanup
    fiber.scope.add(() => {
      model.dispose()
    })

    // 7. Dispose fiber
    disposeFiber(fiber)

    // 8. 验证 cleanup 被调用
    expect(model.dispose).toHaveBeenCalledTimes(1)
  })
})
