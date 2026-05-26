import { describe, expect, it, vi } from "vitest"

import { compileToDescriptors } from "../../descriptor"
import { createRawFieldSchema, createRuntimeGraphHarness } from "./runtimeGraphTestUtils"

import type { Fiber } from "../fiber"

describe("runtime graph flow", () => {
  it("root schema commit 复用同 key 节点并释放被移除节点", () => {
    const { commitSchemas, root, viewRevision } = createRuntimeGraphHarness()

    commitSchemas(root, [
      createRawFieldSchema("name", "name"),
      createRawFieldSchema("age", "age"),
    ])

    const name = root.childFibers[0]
    const age = root.childFibers[1]

    commitSchemas(root, [createRawFieldSchema("name", "name")])

    expect(root.childFibers).toHaveLength(1)
    expect(root.childFibers[0]).toBe(name)
    expect(age?.disposed.value).toBe(true)
    expect(age?.parent).toBeNull()
    expect(viewRevision.revision.value).toBe(2)
  })

  it("same key different kind 会替换节点并保留新结构", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("slot", "slot")])
    const first = root.childFibers[0]

    commitSchemas(root, [
      {
        key: "slot",
        componentType: "group",
        label: "slot",
        children: [createRawFieldSchema("child", "child")],
      },
    ])

    expect(root.childFibers[0]).not.toBe(first)
    expect(root.childFibers[0]?.type).toBe("group")
    expect(
      root.childFibers[0]?.type === "group" && root.childFibers[0].childFibers[0]?.key
    ).toBe("child")
    expect(first?.disposed.value).toBe(true)
  })

  it("nested group public commit 只推进一次 revision", () => {
    const { commitSchemas, root, viewRevision } = createRuntimeGraphHarness()

    commitSchemas(root, [
      {
        componentType: "group",
        label: "parent",
        children: [
          {
            componentType: "group",
            label: "child",
            children: [createRawFieldSchema("field", "field")],
          },
        ],
      },
    ])

    expect(viewRevision.revision.value).toBe(1)
  })

  it("removed-node cleanup 观察到的是已经提交的新 parent.children", () => {
    let rootRef: Fiber | undefined
    const beforeUnmount = vi.fn(() => {
      expect(rootRef?.childFibers.map((child) => child.key)).toEqual(["next"])
    })
    const { commitSchemas, root } = createRuntimeGraphHarness({ beforeUnmount })
    rootRef = root

    commitSchemas(root, [createRawFieldSchema("previous", "previous")])
    commitSchemas(root, [createRawFieldSchema("next", "next")])

    expect(beforeUnmount).toHaveBeenCalledTimes(1)
  })

  it("reconciler 只读取 parent.children，不接受外部 previous 结构", () => {
    const { reconciler, root } = createRuntimeGraphHarness()
    const descriptors = compileToDescriptors([createRawFieldSchema("field", "field")])

    expect(reconciler.reconcileChildren(root, descriptors)).toBe(true)
    expect(root.childFibers[0]?.key).toBe("field")
  })
})
