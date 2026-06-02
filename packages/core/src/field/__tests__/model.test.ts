/**
 * FieldModel 模块测试。
 *
 * @module core/field/__tests__/fieldModel.test
 */

import { describe, expect, it } from "vitest"

import {
  createTestFieldFiber,
  createTestRootFiber,
} from "../../graph/__tests__/fiberTestUtils"
import { createRuntimeScope } from "../../graph/scope"
import { createSignalEffect } from "../../reactivity"
import { createFieldModel, updateFieldModel } from "../model"

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

    const model = createFieldModel(descriptor)
    fiber.fieldModel = model

    expect(fiber.fieldModel).toBe(model)
    expect(model.snapshot.value).toEqual({
      visible: false,
      disabled: true,
      readonly: true,
      required: true,
      label: "",
      rules: [],
      placeholder: "请输入",
      componentProps: { clearable: true },
    })
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
    const model = createFieldModel(descriptor)
    fiber.fieldModel = model

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
    const model = createFieldModel(descriptor)
    fiber.fieldModel = model

    updateFieldModel(model, {
      ...createDescriptor(["field"], {
        visible: false,
        disabled: true,
        readonly: true,
        required: true,
        placeholder: "updated",
        componentProps: { size: "large" },
        rules: ["required"],
      }),
    })

    expect(model.snapshot.value).toEqual({
      visible: false,
      disabled: true,
      readonly: true,
      required: true,
      label: "",
      rules: ["required"],
      placeholder: "updated",
      componentProps: { size: "large" },
    })
  })
})

describe("updateFieldModel", () => {
  it("应该保留 dependencies 解析得到的 false 和空字符串", () => {
    const descriptor = createDescriptor(["field"], {
      visible: true,
      disabled: true,
      readonly: true,
      required: true,
      placeholder: "baseline",
    })
    const model = createFieldModel(descriptor)

    updateFieldModel(model, descriptor, {
      visible: false,
      disabled: false,
      readonly: false,
      required: false,
      placeholder: "",
    })

    expect(model.snapshot.value).toMatchObject({
      visible: false,
      disabled: false,
      readonly: false,
      required: false,
      placeholder: "",
    })
  })

  it("一次更新只应替换一次 snapshot", () => {
    const descriptor = createDescriptor(["field"])
    const model = createFieldModel(descriptor)
    let effectRuns = 0
    const dispose = createSignalEffect(() => {
      void model.snapshot.value
      effectRuns += 1
    })

    updateFieldModel(model, descriptor, {
      visible: false,
      disabled: true,
      readonly: true,
      required: true,
      placeholder: "updated",
      componentProps: { size: "large" },
    })

    expect(effectRuns).toBe(2)

    dispose()
  })

  it("呈现态未变化时不应替换 snapshot", () => {
    const descriptor = createDescriptor(["field"])
    const model = createFieldModel(descriptor)
    let effectRuns = 0
    const dispose = createSignalEffect(() => {
      void model.snapshot.value
      effectRuns += 1
    })

    updateFieldModel(model, descriptor)

    expect(effectRuns).toBe(1)

    dispose()
  })
})
