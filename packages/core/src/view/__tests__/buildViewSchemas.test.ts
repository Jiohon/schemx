/**
 * buildViewSchemas 构建算法单元测试。
 *
 * @module core/view/__tests__/buildViewSchemas.test
 */

import { describe, expect, it } from "vitest"

import { createFieldModel, updateFieldModel } from "../../field/model"
import {
  createTestDependencyRuntimeNode,
  createTestFieldRuntimeNode,
  createTestGroupRuntimeNode,
  createTestRootRuntimeNode,
} from "../../node/__tests__/runtimeNodeTestUtils"
import { buildViewSchemas } from "../buildViewSchemas"

import type { FieldDescriptor } from "../../descriptor/descriptor"
import type { ContainerRuntimeNode, FieldRuntimeNode } from "../../node/runtimeNode"

const createDescriptor = (
  key: string,
  name: string[],
  schema: Partial<FieldDescriptor["schema"]> = {}
): FieldDescriptor => ({
  type: "field",
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
})

const createFieldRuntimeNode = (
  parent: ContainerRuntimeNode,
  key: string,
  name: string[],
  schema: Partial<FieldDescriptor["schema"]> = {}
): FieldRuntimeNode => {
  const descriptor = createDescriptor(key, name, schema)
  const node = createTestFieldRuntimeNode({ key, parent, descriptor })
  node.fieldModel = createFieldModel(descriptor)

  return node
}

describe("buildViewSchemas", () => {
  it("应该在 root 为空时返回空数组", () => {
    expect(buildViewSchemas(null)).toEqual([])
    expect(buildViewSchemas(undefined)).toEqual([])
  })

  it("root RuntimeNode 应该透明展开", () => {
    const root = createTestRootRuntimeNode()
    root.childNodes = [createFieldRuntimeNode(root, "field", ["field"])]

    const schemas = buildViewSchemas(root)

    expect(schemas).toHaveLength(1)
    expect(schemas[0].key).toBe("field")
    expect(schemas[0].componentType).toBe("input")
  })

  it("字段 schema 保持扁平格式，动态呈现态合并为静态值", () => {
    const root = createTestRootRuntimeNode()
    const field = createFieldRuntimeNode(root, "email", ["email"], {
      required: false,
      placeholder: "static",
      componentProps: { clearable: false },
    })
    const model = field.fieldModel
    if (!model) {
      throw new Error("fieldModel should be initialized")
    }

    updateFieldModel(model, field.descriptor, {
      required: true,
      placeholder: "dynamic",
      componentProps: { clearable: true },
    })
    root.childNodes = [field]

    const [schema] = buildViewSchemas(root)

    expect(schema.name).toEqual(["email"])
    expect(schema.componentType).toBe("input")
    expect(schema.required).toBe(true)
    expect(schema.placeholder).toBe("dynamic")
    expect(schema.componentProps).toEqual({ clearable: true })
    expect("state" in schema).toBe(false)
  })

  it("应该从 schema 和 FieldModel 输出 rules 与 validationTrigger", () => {
    const root = createTestRootRuntimeNode()
    const field = createFieldRuntimeNode(root, "email", ["email"], {
      rules: "required",
      validationTrigger: "onBlur" as any,
    })
    const model = field.fieldModel
    if (!model) {
      throw new Error("fieldModel should be initialized")
    }

    updateFieldModel(model, field.descriptor, {
      rules: ["email"],
    })
    root.childNodes = [field]

    const [schema] = buildViewSchemas(root)

    expect(schema.rules).toEqual(["email"])
    expect(schema.validationTrigger).toBe("onBlur")
  })

  it("group 应该投影 children", () => {
    const root = createTestRootRuntimeNode()
    const descriptor = {
      type: "group",
      key: "group",
      schema: {
        label: "group",
        componentType: "group",
      },
      children: [],
    }
    const group = createTestGroupRuntimeNode({ key: "group", parent: root, descriptor })
    group.childNodes = [createFieldRuntimeNode(group, "child", ["child"])]
    root.childNodes = [group]

    const schemas = buildViewSchemas(root)

    expect(schemas[0].componentType).toBe("group")
    expect(schemas[0].children).toHaveLength(1)
    expect(schemas[0].children[0].key).toBe("child")
  })

  it("dependency node 应该透明展开 dynamicChildNodes", () => {
    const root = createTestRootRuntimeNode()
    const dependency = createTestDependencyRuntimeNode({
      key: "dep",
      parent: root,
      descriptor: {
        type: "dependency",
        key: "dep",
        trigger: [],
        renderer: () => [],
      },
    })
    dependency.dependencySlot = {} as any
    dependency.dynamicChildNodes = [
      createFieldRuntimeNode(dependency, "inner", ["inner"]),
    ]
    root.childNodes = [dependency]

    const schemas = buildViewSchemas(root)

    expect(schemas).toHaveLength(1)
    expect(schemas[0].key).toBe("inner")
  })

  it("disposed node 应该被跳过", () => {
    const root = createTestRootRuntimeNode()
    const field = createFieldRuntimeNode(root, "field", ["field"])
    root.childNodes = [field]

    field.disposed.value = true

    expect(buildViewSchemas(root)).toEqual([])
  })
})
