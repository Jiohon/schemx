/**
 * projectViewTree 投影算法单元测试。
 *
 * @module core/view/__tests__/projectViewTree.test
 */

import { describe, expect, it, vi } from "vitest"

import { createFieldModel } from "../../field/model"
import {
  createTestDependencyFiber,
  createTestFieldFiber,
  createTestGroupFiber,
  createTestRootFiber,
} from "../../graph/__tests__/fiberTestUtils"
import { projectViewTree } from "../projectViewTree"

import type { FieldDescriptor } from "../../descriptor/descriptor"
import type { ContainerFiber, FieldFiber } from "../../graph/fiber"
import type { SchemxFormApi } from "../../types"

const createDescriptor = (
  key: string,
  name: string[],
  schema: Partial<FieldDescriptor["schema"]> = {}
): FieldDescriptor => ({
  kind: "field",
  key,
  schema: {
    name,
    label: key,
    componentType: String(schema.componentType ?? "input"),
    visible: true,
    readonly: false,
    disabled: false,
    required: false,
    placeholder: "",
    componentProps: {},
    ...schema,
  },
  validation: {},
})

const createFieldFiber = (
  parent: ContainerFiber,
  key: string,
  name: string[],
  schema: Partial<FieldDescriptor["schema"]> = {}
): FieldFiber => {
  const descriptor = createDescriptor(key, name, schema)
  const fiber = createTestFieldFiber({ key, parent, descriptor })
  fiber.fieldModel = createFieldModel(descriptor)

  return fiber
}

const createFormApi = (): SchemxFormApi =>
  ({
    getValue: vi.fn(() => "value"),
    isTouched: vi.fn(() => true),
    isPending: vi.fn(() => false),
    getError: vi.fn(() => ["error"]),
  }) as any

describe("projectViewTree", () => {
  it("应该在 root 为空时返回空数组", () => {
    expect(projectViewTree(null)).toEqual([])
    expect(projectViewTree(undefined)).toEqual([])
  })

  it("root Fiber 应该透明展开", () => {
    const root = createTestRootFiber()
    root.childFibers = [createFieldFiber(root, "field", ["field"])]

    const tree = projectViewTree(root)

    expect(tree).toHaveLength(1)
    expect(tree[0].key).toBe("field")
    expect(tree[0].type).toBe("field")
  })

  it("字段静态信息来自 descriptor，动态呈现态来自 FieldModel", () => {
    const root = createTestRootFiber()
    const field = createFieldFiber(root, "email", ["email"], {
      required: false,
      placeholder: "static",
      componentProps: { clearable: false },
    })
    field.fieldModel!.required.value = true
    field.fieldModel!.placeholder.value = "dynamic"
    field.fieldModel!.componentProps.value = { clearable: true }
    root.childFibers = [field]

    const [node] = projectViewTree(root, createFormApi())

    expect(node.type).toBe("field")
    expect(node.name).toEqual(["email"])
    expect(node.renderer).toBe("input")
    expect(node.schema).toBe(field.descriptor!.schema)
    expect(node.props.required).toBe(true)
    expect(node.props.placeholder).toBe("dynamic")
    expect(node.props.componentProps).toEqual({ clearable: true })
    expect(node.state.value).toBe("value")
    expect(node.state.touched).toBe(true)
    expect(node.state.errors).toEqual(["error"])
  })

  it("group 应该投影 children", () => {
    const root = createTestRootFiber()
    const descriptor = {
      kind: "group",
      key: "group",
      schema: {
        label: "group",
        componentType: "group",
      },
      children: [],
    }
    const group = createTestGroupFiber({ key: "group", parent: root, descriptor })
    group.childFibers = [createFieldFiber(group, "child", ["child"])]
    root.childFibers = [group]

    const tree = projectViewTree(root)

    expect(tree[0].type).toBe("group")
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].key).toBe("child")
  })

  it("dependency fiber 应该透明展开 subChildren", () => {
    const root = createTestRootFiber()
    const dependency = createTestDependencyFiber({
      key: "dep",
      parent: root,
      descriptor: {
        kind: "dependency",
        key: "dep",
        trigger: [],
        renderer: () => [],
      },
    })
    dependency.dependencySlot = {} as any
    dependency.subChildren = [createFieldFiber(dependency, "inner", ["inner"])]
    root.childFibers = [dependency]

    const tree = projectViewTree(root)

    expect(tree).toHaveLength(1)
    expect(tree[0].key).toBe("inner")
  })

  it("disposed fiber 应该被跳过", () => {
    const root = createTestRootFiber()
    const field = createFieldFiber(root, "field", ["field"])
    root.childFibers = [field]

    field.disposed.value = true

    expect(projectViewTree(root)).toEqual([])
  })
})
