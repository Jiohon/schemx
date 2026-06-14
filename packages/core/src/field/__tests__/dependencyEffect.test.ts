import { describe, expect, it, vi } from "vitest"

import {
  createRawFieldSchema,
  createRuntimeGraphHarness,
  flushRuntimeGraph,
} from "./dependencyRuntimeTestUtils"
import * as fieldModule from "../index"
import { buildViewSchemas } from "../../view"

describe("dependency effect", () => {
  it("只导出 createDependencyEffect 作为 dependency effect 创建入口", () => {
    expect(fieldModule).toHaveProperty("createDependencyEffect")
    expect(fieldModule).not.toHaveProperty("mountDependencyEffect")
  })

  it("renderer 返回的子 schema 会编译后通过 commit boundary 写入 dependency.dynamicChildNodes", async () => {
    const renderer = vi.fn().mockResolvedValue([createRawFieldSchema("child", "child")])
    const { commitSchemas, root, scheduler, viewRevision } = createRuntimeGraphHarness()

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
        to: ["mode"],
        renderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    const dependency = root.childNodes[0]
    expect(dependency?.type).toBe("dependency")
    expect(dependency?.dynamicChildNodes).toHaveLength(1)
    expect(dependency?.dynamicChildNodes[0]?.key).toBe("child")
    expect(dependency?.dynamicChildNodes[0]?.type).toBe("field")
    expect(viewRevision.revision.value).toBe(2)
  })

  it("空 renderer 输出会提交为空子树", async () => {
    const renderer = vi
      .fn()
      .mockResolvedValueOnce([createRawFieldSchema("child", "child")])
      .mockResolvedValueOnce([])
    const { commitSchemas, formApi, root, scheduler } = createRuntimeGraphHarness(
      {},
      { mode: "a" }
    )

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
        to: ["mode"],
        renderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    expect(root.childNodes[0]?.type).toBe("dependency")
    if (root.childNodes[0]?.type !== "dependency") return
    expect(root.childNodes[0].dynamicChildNodes).toHaveLength(1)

    formApi.setValue("mode" as any, "b")
    await flushRuntimeGraph(scheduler)

    expect(root.childNodes[0].dynamicChildNodes).toHaveLength(0)
  })

  it("失败的 renderer 不会覆盖上一次成功提交的 dependency children", async () => {
    const renderer = vi
      .fn()
      .mockResolvedValueOnce([createRawFieldSchema("stable", "stable")])
      .mockRejectedValueOnce(new Error("boom"))
    const { commitSchemas, formApi, root, scheduler } = createRuntimeGraphHarness(
      {},
      { mode: "a" }
    )

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
        to: ["mode"],
        renderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    formApi.setValue("mode" as any, "b")
    await flushRuntimeGraph(scheduler)

    expect(root.childNodes[0]?.type).toBe("dependency")
    if (root.childNodes[0]?.type !== "dependency") return
    expect(root.childNodes[0].dynamicChildNodes.map((child) => child.key)).toEqual([
      "stable",
    ])
  })

  it("旧 renderer 晚于新 renderer 完成时不会覆盖最新 dependency children", async () => {
    let resolveSlowRenderer!: (schemas: any[]) => void
    const slowRenderer = new Promise<any[]>((resolve) => {
      resolveSlowRenderer = resolve
    })
    const renderer = vi
      .fn()
      .mockResolvedValueOnce([createRawFieldSchema("initial", "initial")])
      .mockImplementationOnce(() => slowRenderer)
      .mockResolvedValueOnce([createRawFieldSchema("latest", "latest")])
    const { commitSchemas, formApi, root, scheduler } = createRuntimeGraphHarness(
      {},
      { mode: "initial" }
    )

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
        to: ["mode"],
        renderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    formApi.setValue("mode" as any, "slow")
    await Promise.resolve()

    formApi.setValue("mode" as any, "latest")
    await Promise.resolve()

    resolveSlowRenderer([createRawFieldSchema("stale", "stale")])
    await flushRuntimeGraph(scheduler)

    expect(root.childNodes[0]?.type).toBe("dependency")
    if (root.childNodes[0]?.type !== "dependency") return
    expect(root.childNodes[0].dynamicChildNodes.map((child) => child.key)).toEqual([
      "latest",
    ])
  })
})
