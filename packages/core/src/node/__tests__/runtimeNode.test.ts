import { describe, expect, it } from "vitest"

import { getChildRuntimeNodes, setChildRuntimeNodes } from "../runtimeNode"

import { createTestFieldRuntimeNode, createTestRootRuntimeNode } from "./runtimeNodeTestUtils"

import type { FieldDescriptor } from "../../descriptor"

function createFieldDescriptor(key: string): FieldDescriptor {
  return {
    type: "field",
    key,
    name: key,
    componentType: "input",
    staticSchema: {
      name: key,
      componentType: "input",
      visible: true,
      readonly: false,
      disabled: false,
      required: false,
      placeholder: "",
      componentProps: {},
    },
  }
}

describe("node child helpers", () => {
  it("应该读写 root.childNodes", () => {
    const root = createTestRootRuntimeNode()
    const field = createTestFieldRuntimeNode({
      key: "name",
      parent: root,
      descriptor: createFieldDescriptor("name"),
    })

    setChildRuntimeNodes(root, [field])

    expect(root.childNodes).toEqual([field])
    expect(getChildRuntimeNodes(root)).toEqual([field])
  })

  it("RuntimeNode 只保留结构字段，不直接挂载领域资源", () => {
    const root = createTestRootRuntimeNode()
    const field = createTestFieldRuntimeNode({
      key: "name",
      parent: root,
      descriptor: createFieldDescriptor("name"),
    })

    expect(field).not.toHaveProperty("descriptor")
    expect(field).not.toHaveProperty("runtimeState")
    expect(field).not.toHaveProperty("viewState")
    expect(field).not.toHaveProperty("fieldResourceScope")
    expect(field).not.toHaveProperty("fieldDependenciesScope")
  })
})
