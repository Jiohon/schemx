import { describe, expect, it, vi } from "vitest"

import { createRuntimeGraphHarness, flushRuntimeGraph } from "./runtimeGraphTestUtils"

describe("dependency flow", () => {
  it("dependencyIndex 跟随 dependency mount/update/unmount 维护触发字段反向查询", async () => {
    const { commitSchemas, context, root, scheduler } = createRuntimeGraphHarness()

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
        to: ["mode"],
        renderer: vi.fn().mockResolvedValue([]),
      },
    ])
    await flushRuntimeGraph(scheduler)

    const dependency = root.childNodes[0]
    if (dependency?.type !== "dependency") {
      throw new Error("expected dependency node")
    }

    expect(context.nodeResources.dependencyIndex.getByTriggerField("mode" as any)).toEqual([
      dependency,
    ])

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
        to: ["kind"],
        renderer: vi.fn().mockResolvedValue([]),
      },
    ])
    await flushRuntimeGraph(scheduler)

    expect(context.nodeResources.dependencyIndex.getByTriggerField("mode" as any)).toEqual([])
    expect(context.nodeResources.dependencyIndex.getByTriggerField("kind" as any)).toEqual([
      dependency,
    ])

    commitSchemas(root, [])
    await flushRuntimeGraph(scheduler)

    expect(context.nodeResources.dependencyIndex.getByTriggerField("kind" as any)).toEqual([])
  })

  it("trigger 不变时保留 dependency effect，trigger 变化时重建", async () => {
    const { commitSchemas, context, root, scheduler } = createRuntimeGraphHarness()

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
        to: ["mode"],
        renderer: vi.fn().mockResolvedValue([]),
      },
    ])
    await flushRuntimeGraph(scheduler)

    const dependency = root.childNodes[0]
    if (dependency?.type !== "dependency") {
      throw new Error("expected dependency node")
    }

    const firstEffect = context.nodeResources.dependencyEffects.get(dependency.id)
    expect(firstEffect).toBeDefined()

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
        to: ["mode"],
        renderer: vi.fn().mockResolvedValue([]),
      },
    ])
    await flushRuntimeGraph(scheduler)

    expect(context.nodeResources.dependencyEffects.get(dependency.id)).toBe(firstEffect)

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
        to: ["kind"],
        renderer: vi.fn().mockResolvedValue([]),
      },
    ])
    await flushRuntimeGraph(scheduler)

    expect(context.nodeResources.dependencyEffects.get(dependency.id)).not.toBe(firstEffect)
  })

  it("trigger 不变但 renderer 变化时，下一次执行使用最新 descriptor", async () => {
    const firstRenderer = vi.fn().mockResolvedValue([])
    const secondRenderer = vi.fn().mockResolvedValue([])
    const { commitSchemas, formApi, root, scheduler } = createRuntimeGraphHarness(
      {},
      { mode: "a" }
    )

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
        to: ["mode"],
        renderer: firstRenderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
        to: ["mode"],
        renderer: secondRenderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    formApi.setValue("mode" as any, "b")
    await flushRuntimeGraph(scheduler)

    expect(secondRenderer).toHaveBeenCalled()
  })
})
