/**
 * buildViewSchemas 构建算法单元测试。
 *
 * @module core/view/__tests__/buildViewSchemas.test
 */

import { describe, expect, it } from "vitest"

import { createFieldModel } from "../../field/model"
import {
  createTestDependencyFiber,
  createTestFieldFiber,
  createTestGroupFiber,
  createTestRootFiber,
} from "../../graph/__tests__/fiberTestUtils"
import { buildViewSchemas } from "../buildViewSchemas"

import type { FieldDescriptor } from "../../descriptor/descriptor"
import type { ContainerFiber, FieldFiber } from "../../graph/fiber"

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

describe("buildViewSchemas", () => {
  it("应该在 root 为空时返回空数组", () => {
    expect(buildViewSchemas(null)).toEqual([])
    expect(buildViewSchemas(undefined)).toEqual([])
  })

  it("root Fiber 应该透明展开", () => {
    const root = createTestRootFiber()
    root.childFibers = [createFieldFiber(root, "field", ["field"])]

    const schemas = buildViewSchemas(root)

    expect(schemas).toHaveLength(1)
    expect(schemas[0].key).toBe("field")
    expect(schemas[0].componentType).toBe("input")
  })

  it("字段 schema 保持扁平格式，动态呈现态合并为静态值", () => {
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

    const [schema] = buildViewSchemas(root)

    expect(schema.name).toEqual(["email"])
    expect(schema.componentType).toBe("input")
    expect(schema.required).toBe(true)
    expect(schema.placeholder).toBe("dynamic")
    expect(schema.componentProps).toEqual({ clearable: true })
    expect("state" in schema).toBe(false)
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

    const schemas = buildViewSchemas(root)

    expect(schemas[0].componentType).toBe("group")
    expect(schemas[0].children).toHaveLength(1)
    expect(schemas[0].children[0].key).toBe("child")
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

    const schemas = buildViewSchemas(root)

    expect(schemas).toHaveLength(1)
    expect(schemas[0].key).toBe("inner")
  })

  it("disposed fiber 应该被跳过", () => {
    const root = createTestRootFiber()
    const field = createFieldFiber(root, "field", ["field"])
    root.childFibers = [field]

    field.disposed.value = true

    expect(buildViewSchemas(root)).toEqual([])
  })
})
