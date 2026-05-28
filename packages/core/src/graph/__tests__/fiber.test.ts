import { describe, expect, it } from "vitest"

import { getChildFibers, setChildFibers } from "../fiber"

import { createTestFieldFiber, createTestRootFiber } from "./fiberTestUtils"

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

describe("fiber child helpers", () => {
  it("应该读写 root.childFibers", () => {
    const root = createTestRootFiber()
    const field = createTestFieldFiber({
      key: "name",
      parent: root,
      descriptor: createFieldDescriptor("name"),
    })

    setChildFibers(root, [field])

    expect(root.childFibers).toEqual([field])
    expect(getChildFibers(root)).toEqual([field])
  })
})
