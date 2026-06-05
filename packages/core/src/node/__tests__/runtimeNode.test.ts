import { describe, expect, it } from "vitest"

import { getChildRuntimeNodes, setChildRuntimeNodes } from "../runtimeNode"

import { createTestFieldRuntimeNode, createTestRootRuntimeNode } from "./runtimeNodeTestUtils"

import type { FieldDescriptor } from "../../descriptor"

function createFieldDescriptor(key: string): FieldDescriptor {
  return {
    type: "field",
    key,
    schema: {
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
})
