import { describe, expect, it, vi } from "vitest"

import {
  createRawFieldSchema,
  createRuntimeGraphHarness,
  flushRuntimeGraph,
} from "./dependencyRuntimeTestUtils"

describe("dependency effect", () => {
  it("renderer 返回的子 schema 会编译后通过 commit boundary 写入 dependency.subChildren", async () => {
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

    const dependency = root.childFibers[0]
    expect(dependency?.type).toBe("dependency")
    expect(dependency?.subChildren).toHaveLength(1)
    expect(dependency?.subChildren[0]?.key).toBe("child")
    expect(dependency?.subChildren[0]?.type).toBe("field")
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

    expect(root.childFibers[0]?.type).toBe("dependency")
    if (root.childFibers[0]?.type !== "dependency") return
    expect(root.childFibers[0].subChildren).toHaveLength(1)

    formApi.setValue("mode" as any, "b")
    await flushRuntimeGraph(scheduler)

    expect(root.childFibers[0].subChildren).toHaveLength(0)
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

    expect(root.childFibers[0]?.type).toBe("dependency")
    if (root.childFibers[0]?.type !== "dependency") return
    expect(root.childFibers[0].subChildren.map((child) => child.key)).toEqual(["stable"])
  })
})
