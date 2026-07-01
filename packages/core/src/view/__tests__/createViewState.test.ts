import { describe, expect, it } from "vitest"

import { createFieldRuntimeState } from "../../field"
import { createSignal } from "../../reactivity"
import { createRuntimeResources } from "../../node/resources"
import {
  createFieldRuntimeNode,
  createGroupRuntimeNode,
  createRootRuntimeNode,
} from "../../node/runtimeNode"
import { createScope } from "../../node/scope"
import {
  createRuntimeViewState,
  createRootRuntimeViewState,
  deleteRuntimeViewState,
} from "../createViewState"

import type { FieldDescriptor, GroupDescriptor } from "../../descriptor"

describe("createViewState", () => {
  it("为 root 创建并注册 root viewState", () => {
    const resources = createRuntimeResources()
    const root = createRootRuntimeNode({ scope: createScope() })

    resources.childrenStates.set(root.id, {
      children: createSignal([]),
    })

    const state = createRootRuntimeViewState(root, resources)

    expect(resources.viewStates.get(root.id)).toBe(state)
    expect(state.viewSchemas.value).toEqual([])
  })

  it("为 field 创建并注册 field viewState", () => {
    const resources = createRuntimeResources()
    const node = createFieldRuntimeNode({
      id: 1,
      key: "field:name",
      scope: createScope(),
    })
    const descriptor = {
      type: "field",
      key: "field:name",
      name: "name",
      componentType: "input",
      staticSchema: {
        name: "name",
        componentType: "input",
        label: "姓名",
      },
    } as FieldDescriptor
    const runtimeState = createFieldRuntimeState({
      nodeId: node.id,
      key: node.key,
      descriptor,
    })

    resources.fieldStates.set(node.id, runtimeState)

    const state = createRuntimeViewState(node, descriptor, resources)

    expect(resources.viewStates.get(node.id)).toBe(state)
    expect("view" in state ? state.view.value?.key : undefined).toBe("field:name")
  })

  it("为 group 创建并注册 group viewState", () => {
    const resources = createRuntimeResources()
    const node = createGroupRuntimeNode({
      id: 1,
      key: "group:0",
      scope: createScope(),
    })
    const descriptor = {
      type: "group",
      key: "group:0",
      staticSchema: {
        componentType: "group",
        label: "分组",
      },
      children: [],
    } as GroupDescriptor

    resources.childrenStates.set(node.id, {
      children: createSignal([]),
    })

    const state = createRuntimeViewState(node, descriptor, resources)

    expect(resources.viewStates.get(node.id)).toBe(state)
    expect("view" in state ? state.view.value?.key : undefined).toBe("group:0")
  })

  it("删除节点 viewState", () => {
    const resources = createRuntimeResources()
    const node = createFieldRuntimeNode({
      id: 1,
      key: "field:name",
      scope: createScope(),
    })

    resources.viewStates.set(node.id, {} as never)

    deleteRuntimeViewState(node, resources)

    expect(resources.viewStates.has(node.id)).toBe(false)
  })
})
