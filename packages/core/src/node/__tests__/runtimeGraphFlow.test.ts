import { describe, expect, it, vi } from "vitest"

import { createCompile } from "../../compiler"
import { withSchemxContext } from "../../schemxContext"
import { createRawFieldSchema, createRuntimeGraphHarness } from "./runtimeGraphTestUtils"

import type { RuntimeNode } from "../types"

describe("runtime node flow", () => {
  it("root schema commit 复用同 key 节点并释放被移除节点", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [
      createRawFieldSchema("name", "name"),
      createRawFieldSchema("age", "age"),
    ])

    const name = root.childNodes[0]
    const age = root.childNodes[1]

    commitSchemas(root, [createRawFieldSchema("name", "name")])

    expect(root.childNodes).toHaveLength(1)
    expect(root.childNodes[0]).toBe(name)
    expect(age?.disposed.value).toBe(true)
    expect(age?.parent).toBeNull()
  })

  it("same key different kind 会替换节点并保留新结构", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("slot", "slot")])
    const first = root.childNodes[0]

    commitSchemas(root, [
      {
        key: "slot",
        componentType: "group",
        label: "slot",
        children: [createRawFieldSchema("child", "child")],
      },
    ])

    expect(root.childNodes[0]).not.toBe(first)
    expect(root.childNodes[0]?.type).toBe("group")
    expect(
      root.childNodes[0]?.type === "group" && root.childNodes[0].childNodes[0]?.key
    ).toBe("child")
    expect(first?.disposed.value).toBe(true)
  })

  it("nested group public commit 只推进一次结构提交", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

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

    expect(root.childNodes).toHaveLength(1)
  })

  it("removed-node cleanup 观察到的是已经提交的新 parent.children", () => {
    let rootRef: RuntimeNode | undefined
    const beforeUnmount = vi.fn(() => {
      expect(rootRef?.childNodes.map((child) => child.key)).toEqual(["next"])
    })
    const { commitSchemas, root } = createRuntimeGraphHarness({ beforeUnmount })
    rootRef = root

    commitSchemas(root, [createRawFieldSchema("previous", "previous")])
    commitSchemas(root, [createRawFieldSchema("next", "next")])

    expect(beforeUnmount).toHaveBeenCalledTimes(1)
  })

  it("reconciler 只读取 parent.children，不接受外部 previous 结构", () => {
    const { context, reconciler, root } = createRuntimeGraphHarness()
    const descriptors = createCompile().toDescriptors([createRawFieldSchema("field", "field")])

    withSchemxContext(context, () => {
      reconciler.reconcileChildren(root, descriptors)
    })

    expect(root.childNodes[0]?.key).toBe("field")
  })
})
