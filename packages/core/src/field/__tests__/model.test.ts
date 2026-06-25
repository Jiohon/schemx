/**
 * FieldModel 模块测试。
 *
 * @module core/field/__tests__/fieldModel.test
 */

import { describe, expect, it } from "vitest"

import {
  createTestFieldRuntimeNode,
  createTestRootRuntimeNode,
} from "../../node/__tests__/runtimeNodeTestUtils"
import { createRuntimeScope } from "../../node/scope"
import { createSignalEffect } from "../../reactivity"
import {
  createFieldModel,
  createFieldModelFromRuntimeState,
  updateFieldModel,
} from "../model"
import {
  createFieldRuntimeState,
  setFieldDynamicOverrides,
  setFieldStaticSchema,
} from "../runtimeState"

import type { FieldDescriptor } from "../../descriptor/descriptor"
import type { SchemxResolvedBaseField } from "../../types"

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

function createTestSchema(
  overrides: Partial<SchemxResolvedBaseField> = {}
): SchemxResolvedBaseField {
  return {
    componentType: "input",
    label: "测试字段",
    visible: true,
    disabled: false,
    readonly: false,
    required: false,
    placeholder: "请输入",
    componentProps: {},
    rules: [],
    validationTrigger: "onChange",
    ...overrides,
  } as SchemxResolvedBaseField
}

describe("FieldModel", () => {
  it("应该创建纯呈现态 FieldModel 并挂载到 RuntimeNode", () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(["user", "name"], {
      visible: false,
      disabled: true,
      readonly: true,
      required: true,
      placeholder: "请输入",
      componentProps: { clearable: true },
    })
    const root = createTestRootRuntimeNode()
    const node = createTestFieldRuntimeNode({
      key: "field",
      parent: root,
      descriptor,
      scope,
    })

    const model = createFieldModel(descriptor)
    node.fieldModel = model

    expect(node.fieldModel).toBe(model)
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

  it("snapshot 应该是只读信号", () => {
    const descriptor = createDescriptor(["field"])
    const model = createFieldModel(descriptor)

    if (false) {
      // @ts-expect-error snapshot 是只读信号，不能直接写入
      model.snapshot.value = {
        visible: false,
        disabled: true,
        readonly: true,
        required: true,
        label: "",
        rules: [],
        placeholder: "updated",
        componentProps: {},
      }
    }

    expect(model.snapshot.value.visible).toBe(true)
  })

  it("resource scope dispose 后应保留 RuntimeNode 上的 FieldModel 快照", () => {
    const nodeScope = createRuntimeScope()
    const resourceScope = nodeScope.child()
    const descriptor = createDescriptor(["field"])
    const root = createTestRootRuntimeNode()
    const node = createTestFieldRuntimeNode({
      key: "field",
      parent: root,
      descriptor,
      scope: nodeScope,
    })
    const model = createFieldModel(descriptor)
    node.fieldModel = model

    expect(node.fieldModel).toBe(model)

    resourceScope.dispose()

    expect(node.fieldModel).toBe(model)
  })
})

describe("updateFieldModel", () => {
  it("应该用新的 descriptor 静态 schema 刷新呈现态 baseline", () => {
    const descriptor = createDescriptor(["field"])
    const root = createTestRootRuntimeNode()
    const node = createTestFieldRuntimeNode({ key: "field", parent: root, descriptor })
    const model = createFieldModel(descriptor)
    node.fieldModel = model

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

describe("createFieldModelFromRuntimeState", () => {
  it("应该从 runtimeState 派生兼容 facade", () => {
    const schema = createTestSchema({ label: "用户名" })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: {
        name: "username" as any,
        schema,
      },
    })
    const model = createFieldModelFromRuntimeState(state)

    expect(model.snapshot.value.label).toBe("用户名")
    expect(model.snapshot.value.visible).toBe(true)

    setFieldStaticSchema(state, {
      name: "username" as any,
      schema: {
        ...schema,
        label: "邮箱",
        visible: false,
      },
    })

    expect(model.snapshot.value.label).toBe("邮箱")
    expect(model.snapshot.value.visible).toBe(false)

    setFieldDynamicOverrides(
      state,
      {
        visible: true,
        placeholder: "",
      },
      {
        source: "dependencies",
        triggerFields: [["profile", "enabled"] as any],
      }
    )

    expect(model.snapshot.value.visible).toBe(true)
    expect(model.snapshot.value.placeholder).toBe("")
  })
})
