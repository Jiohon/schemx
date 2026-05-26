/**
 * FieldModel 模块测试。
 *
 * @module core/field/__tests__/fieldModel.test
 */

import { describe, expect, it } from "vitest"

import { createRuntimeScope } from "../../graph/scope"
import {
  createTestFieldFiber,
  createTestRootFiber,
} from "../../graph/__tests__/fiberTestUtils"
import { mountFieldModel, updateFieldModel } from "../model"

import type { FieldDescriptor } from "../../descriptor/descriptor"

const createDescriptor = (
  name: string[],
  schema: Partial<FieldDescriptor["schema"]> = {}
): FieldDescriptor => ({
  type: "field",
  key: `field-${name.join("-")}`,
  schema: {
    name,
    componentType: "input",
    visible: true,
    readonly: false,
    disabled: false,
    required: false,
    placeholder: "",
    componentProps: {},
    ...schema,
  },
  validation: {
    rules: [],
  },
})

describe("mountFieldModel", () => {
  it("应该创建纯呈现态 FieldModel 并挂载到 Fiber", () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(["user", "name"], {
      visible: false,
      disabled: true,
      readonly: true,
      required: true,
      placeholder: "请输入",
      componentProps: { clearable: true },
    })
    const root = createTestRootFiber()
    const fiber = createTestFieldFiber({ key: "field", parent: root, descriptor, scope })

    const model = mountFieldModel(fiber, descriptor)

    expect(fiber.fieldModel).toBe(model)
    expect(model.visible.value).toBe(false)
    expect(model.disabled.value).toBe(true)
    expect(model.readonly.value).toBe(true)
    expect(model.required.value).toBe(true)
    expect(model.placeholder.value).toBe("请输入")
    expect(model.componentProps.value).toEqual({ clearable: true })
    expect("name" in model).toBe(false)
    expect("state" in model).toBe(false)
    expect("props" in model).toBe(false)
    expect("scope" in model).toBe(false)
  })

  it("resource scope dispose 后应保留 Fiber 上的 FieldModel 快照", () => {
    const fiberScope = createRuntimeScope()
    const resourceScope = fiberScope.child()
    const descriptor = createDescriptor(["field"])
    const root = createTestRootFiber()
    const fiber = createTestFieldFiber({
      key: "field",
      parent: root,
      descriptor,
      scope: fiberScope,
    })
    const model = mountFieldModel(fiber, descriptor, resourceScope)

    expect(fiber.fieldModel).toBe(model)

    resourceScope.dispose()

    expect(fiber.fieldModel).toBe(model)
  })
})

describe("updateFieldModel", () => {
  it("应该用新的 descriptor 静态 schema 刷新呈现态 baseline", () => {
    const descriptor = createDescriptor(["field"])
    const root = createTestRootFiber()
    const fiber = createTestFieldFiber({ key: "field", parent: root, descriptor })
    const model = mountFieldModel(fiber, descriptor)

    updateFieldModel(model, {
      ...createDescriptor(["field"], {
        visible: false,
        disabled: true,
        readonly: true,
        required: true,
        placeholder: "updated",
        componentProps: { size: "large" },
      }),
      validation: {
        rules: ["required"],
      },
    })

    expect(model.visible.value).toBe(false)
    expect(model.disabled.value).toBe(true)
    expect(model.readonly.value).toBe(true)
    expect(model.required.value).toBe(true)
    expect(model.placeholder.value).toBe("updated")
    expect(model.componentProps.value).toEqual({ size: "large" })
    expect(model.rules.value).toEqual(["required"])
  })
})
