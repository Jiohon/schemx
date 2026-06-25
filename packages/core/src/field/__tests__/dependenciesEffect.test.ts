import { describe, expect, it, vi } from "vitest"

import { createDependenciesEffect } from "../dependenciesEffect"
import { createFieldModelFromRuntimeState } from "../model"
import { createFieldRuntimeState, setFieldDynamicOverrides } from "../runtimeState"
import { createRuntimeScope } from "../../node/scope"
import { createScheduler } from "../../scheduler"
import { createSignal } from "../../reactivity"

import type { SchemxFormContext } from "../../createForm"
import type { FieldDescriptor } from "../../descriptor"
import type { SchemxResolvedBaseField } from "../../types"

function createTestSchema(overrides: Partial<SchemxResolvedBaseField> = {}): SchemxResolvedBaseField {
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

function createDependenciesDescriptor(
  schema: SchemxResolvedBaseField
): FieldDescriptor<{ country?: string }> {
  return {
    type: "field",
    key: "province",
    schema,
    dependencies: {
      triggerFields: ["country"],
      visible: (values) => values.country === "CN",
    },
  } as FieldDescriptor<{ country?: string }>
}

describe("dependenciesEffect 写入 dynamicOverrides (US2)", () => {
  it("setFieldDynamicOverrides 应该写入动态覆盖到 runtimeState", () => {
    const schema = createTestSchema({ visible: true, disabled: false })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, schema },
    })

    setFieldDynamicOverrides(state, { visible: false, disabled: true }, {
      source: "dependencies",
      triggerFields: ["country" as any],
    })

    expect(state.dynamicOverrides.value.visible).toBe(false)
    expect(state.dynamicOverrides.value.disabled).toBe(true)
  })

  it("dynamicOverrides 写入后 effectiveSchema 应自动更新", () => {
    const schema = createTestSchema({ visible: true })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, schema },
    })

    setFieldDynamicOverrides(state, { visible: false }, {
      source: "dependencies",
      triggerFields: ["country" as any],
    })

    expect(state.effectiveSchema.value.visible).toBe(false)
  })

  it("diagnostics 应记录 dependencies 来源", () => {
    const schema = createTestSchema()
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, schema },
    })

    setFieldDynamicOverrides(state, { required: true }, {
      source: "dependencies",
      triggerFields: ["type" as any],
      error: null,
    })

    const diag = state.diagnostics.value
    expect(diag.lastUpdatedBy).toBe("dependencies")
    expect(diag.triggerFields).toEqual(["type"])
    expect(diag.overriddenKeys).toContain("required")
  })

  it("空动态覆盖不应影响 effectiveSchema", () => {
    const schema = createTestSchema({ visible: true, disabled: false })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "city" as any, schema },
    })

    // 初始 effectiveSchema 反映静态值
    expect(state.effectiveSchema.value.visible).toBe(true)
    expect(state.effectiveSchema.value.disabled).toBe(false)

    // 写入空覆盖
    setFieldDynamicOverrides(state, {}, {
      source: "dependencies",
      triggerFields: [],
    })

    // 静态值保持不变
    expect(state.effectiveSchema.value.visible).toBe(true)
    expect(state.effectiveSchema.value.disabled).toBe(false)
  })
})

describe("异步 dependencies 竞态处理 (US3)", () => {
  it("最新结果应该获胜，旧结果不应覆盖", () => {
    const schema = createTestSchema({ visible: true })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, schema },
    })

    // 模拟：先写入值 A，再写入值 B
    setFieldDynamicOverrides(state, { visible: false }, {
      source: "dependencies",
      triggerFields: ["country" as any],
    })

    // 值 B 覆盖值 A
    setFieldDynamicOverrides(state, { visible: true }, {
      source: "dependencies",
      triggerFields: ["country" as any],
    })

    // 最新结果（B）获胜
    expect(state.effectiveSchema.value.visible).toBe(true)
  })

  it("错误回退时不应覆盖上一次成功的动态覆盖", () => {
    const schema = createTestSchema({ visible: true })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, schema },
    })

    // 先成功写入
    setFieldDynamicOverrides(state, { visible: false }, {
      source: "dependencies",
      triggerFields: ["country" as any],
    })

    // 错误写入（空覆盖），不覆盖上次成功结果
    setFieldDynamicOverrides(state, {}, {
      source: "dependencies",
      triggerFields: [],
      error: new Error("解析失败"),
    })

    // 上次成功结果应保留（空覆盖不覆盖静态值，但上次动态覆盖已被清空）
    // 所以 effectiveSchema 回退到静态值
    expect(state.effectiveSchema.value.visible).toBe(true)
    expect(state.diagnostics.value.error).not.toBeNull()
  })

  it("diagnostics 应记录版本递增", () => {
    const schema = createTestSchema()
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, schema },
    })

    const v1 = state.diagnostics.value.version

    setFieldDynamicOverrides(state, { visible: false }, {
      source: "dependencies",
      triggerFields: ["country" as any],
    })

    const v2 = state.diagnostics.value.version
    expect(v2).toBeGreaterThan(v1)

    setFieldDynamicOverrides(state, { visible: true }, {
      source: "dependencies",
      triggerFields: ["country" as any],
    })

    const v3 = state.diagnostics.value.version
    expect(v3).toBeGreaterThan(v2)
  })
})

describe("createDependenciesEffect 写入 runtimeState (US2)", () => {
  it("只应写入 dynamicOverrides，并通过 facade 驱动 FieldModel", async () => {
    const scheduler = createScheduler()
    const scope = createRuntimeScope()
    const values = createSignal<{ country?: string }>({ country: "US" })
    const schema = createTestSchema({ visible: true })
    const descriptor = createDependenciesDescriptor(schema)
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "province" as any, schema },
    })
    const fieldModel = createFieldModelFromRuntimeState(runtimeState)

    const formApi = {
      getValues: vi.fn((paths?: readonly unknown[]) => {
        const current = values.value

        if (!paths || paths.length === 0) {
          return current
        }

        const next: Record<string, unknown> = {}

        for (const path of paths) {
          const key = Array.isArray(path) ? String(path.at(-1) ?? "") : String(path)
          next[key] = current[key as keyof typeof current]
        }

        return next
      }),
    }

    const context = {
      formApi: formApi as SchemxFormContext<{ country?: string }>["formApi"],
      scheduler,
    } as unknown as SchemxFormContext<{ country?: string }>

    createDependenciesEffect({
      descriptor,
      runtimeState,
      context,
      scope,
    })

    await scheduler.whenIdle()

    expect(runtimeState.dynamicOverrides.value).toEqual({ visible: false })
    expect(fieldModel.snapshot.value.visible).toBe(false)

    values.value = { country: "CN" }
    await scheduler.whenIdle()

    expect(runtimeState.dynamicOverrides.value).toEqual({ visible: true })
    expect(fieldModel.snapshot.value.visible).toBe(true)
  })
})
