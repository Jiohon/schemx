/**
 * ValidationEffect 模块测试。
 *
 * @module core/field/__tests__/validationEffect.test
 */

import { describe, expect, it, vi } from "vitest"

import { createRuntimeScope } from "../../node/scope"
import { createSignal, createSignalEffect } from "../../reactivity"
import { createScheduler } from "../../scheduler"
import { createValidationEffect } from "../validationEffect"
import { createFieldRuntimeState, setFieldDynamicOverrides } from "../runtimeState"

import type { SchemxFormContext } from "../../createForm"
import type { FieldDescriptor } from "../../descriptor"
import type { SchemxBaseField } from "../../types"
import type { ValidateResult } from "../../validator"

interface TestValues {
  field?: string
}

const createSchema = (
  overrides: Partial<SchemxBaseField<TestValues>> = {}
): SchemxBaseField<TestValues> => ({
  name: "field",
  label: "字段",
  componentType: "input",
  visible: true,
  readonly: false,
  disabled: false,
  rules: "required",
  ...overrides,
})

const createDescriptor = (schema = createSchema()): FieldDescriptor<TestValues> => ({
  type: "field",
  key: "field:0:field",
  schema,
})

const createContext = (
  options: {
    validateResult?: ValidateResult<TestValues>
  } = {}
) => {
  const scheduler = createScheduler()
  const instance = {
    registerRules: vi.fn(),
    unregisterRules: vi.fn(),
    setFieldError: vi.fn(),
    validateField: vi.fn().mockResolvedValue(
      options.validateResult ?? {
        ok: true,
        values: { field: "value" },
      }
    ),
  }

  return {
    context: {
      instance,
      scheduler,
    } as unknown as SchemxFormContext<TestValues>,
    instance,
    scheduler,
  }
}

describe("createValidationEffect", () => {
  it("应该创建 ValidationEffect 并注册规则", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor()
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: descriptor.key,
      descriptor: { name: descriptor.schema.name, schema: descriptor.schema },
    })
    const { context, instance, scheduler } = createContext()

    const validation = createValidationEffect({
      name: "field",
      effectiveSchema: runtimeState.effectiveSchema,
      scope,
      context,
    })

    await scheduler.flush()

    expect(validation.registered.value).toBe(true)
    expect(validation.validating.value).toBe(false)
    expect(instance.registerRules).toHaveBeenCalledWith(
      "field",
      descriptor.schema.rules,
      "字段为必填项"
    )
  })
})

describe("rule management", () => {
  it("应该在 visible=false 时从 Validator 注销规则并清空错误", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(createSchema({ visible: false }))
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: descriptor.key,
      descriptor: { name: descriptor.schema.name, schema: descriptor.schema },
    })
    const { context, instance, scheduler } = createContext()

    createValidationEffect({
      name: "field",
      effectiveSchema: runtimeState.effectiveSchema,
      scope,
      context,
    })

    await scheduler.flush()

    expect(instance.unregisterRules).toHaveBeenCalledWith("field")
    expect(instance.setFieldError).toHaveBeenCalledWith("field", [])
  })

  it("应该在 readonly=true 时从 Validator 注销规则并清空错误", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(createSchema({ readonly: true }))
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: descriptor.key,
      descriptor: { name: descriptor.schema.name, schema: descriptor.schema },
    })
    const { context, instance, scheduler } = createContext()

    createValidationEffect({
      name: "field",
      effectiveSchema: runtimeState.effectiveSchema,
      scope,
      context,
    })

    await scheduler.flush()

    expect(instance.unregisterRules).toHaveBeenCalledWith("field")
    expect(instance.setFieldError).toHaveBeenCalledWith("field", [])
  })

  it("应该在 disabled=true 时从 Validator 注销规则并清空错误", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(createSchema({ disabled: true }))
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: descriptor.key,
      descriptor: { name: descriptor.schema.name, schema: descriptor.schema },
    })
    const { context, instance, scheduler } = createContext()

    createValidationEffect({
      name: "field",
      effectiveSchema: runtimeState.effectiveSchema,
      scope,
      context,
    })

    await scheduler.flush()

    expect(instance.unregisterRules).toHaveBeenCalledWith("field")
    expect(instance.setFieldError).toHaveBeenCalledWith("field", [])
  })

  it("字段呈现态在响应式 effect 中变化时不应同步写 Validator 造成循环", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor()
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: descriptor.key,
      descriptor: { name: descriptor.schema.name, schema: descriptor.schema },
    })
    const trigger = createSignal(0)
    const { context, instance, scheduler } = createContext()

    createValidationEffect({
      name: "field",
      effectiveSchema: runtimeState.effectiveSchema,
      scope,
      context,
    })

    const dispose = createSignalEffect(() => {
      if (trigger.value > 0) {
        setFieldDynamicOverrides(
          runtimeState,
          {
            visible: false,
          },
          {
            source: "dependencies",
            triggerFields: ["status" as any],
          }
        )
      }
    })

    expect(() => {
      trigger.value = 1
    }).not.toThrow()

    await scheduler.flush()

    expect(instance.unregisterRules).toHaveBeenCalledWith("field")

    dispose()
  })
})

describe("validate method", () => {
  it("应该通过 Validator 校验 Store 快照", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor()
    const runtimeState = createFieldRuntimeState({
      nodeId: 1,
      key: descriptor.key,
      descriptor: { name: descriptor.schema.name, schema: descriptor.schema },
    })
    const { context, instance } = createContext()

    const validation = createValidationEffect({
      name: "field",
      effectiveSchema: runtimeState.effectiveSchema,
      scope,
      context,
    })

    const result = await validation.validate()

    expect(result).toEqual({ ok: true, values: { field: "value" } })
    expect(instance.validateField).toHaveBeenCalledWith("field")
  })
})

import type { SchemxResolvedBaseField } from "../../types"

function createTestSchemaForUS2(overrides: Partial<SchemxResolvedBaseField> = {}): SchemxResolvedBaseField {
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

describe("validationEffect 读取 effectiveSchema (US2)", () => {
  it("effectiveSchema 应包含 rules 信息供 validation 读取", () => {
    const schema = createTestSchemaForUS2({ rules: [{ required: true }] as any })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "email" as any, schema },
    })

    expect(state.effectiveSchema.value.rules).toEqual([{ required: true }])
  })

  it("dynamicOverrides 更新 rules 后 effectiveSchema 应反映新 rules", () => {
    const schema = createTestSchemaForUS2({ rules: [{ required: true }] as any })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "email" as any, schema },
    })

    setFieldDynamicOverrides(state, { rules: [{ min: 3 }] as any }, {
      source: "dependencies",
      triggerFields: ["type" as any],
    })

    expect(state.effectiveSchema.value.rules).toEqual([{ min: 3 }])
  })

  it("effectiveSchema 应包含 visible/readonly/disabled 供 validation 判断", () => {
    const schema = createTestSchemaForUS2({ visible: true, readonly: false, disabled: false })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "email" as any, schema },
    })

    expect(state.effectiveSchema.value.visible).toBe(true)
    expect(state.effectiveSchema.value.readonly).toBe(false)
    expect(state.effectiveSchema.value.disabled).toBe(false)

    setFieldDynamicOverrides(state, { visible: false, readonly: true }, {
      source: "dependencies",
      triggerFields: ["status" as any],
    })

    expect(state.effectiveSchema.value.visible).toBe(false)
    expect(state.effectiveSchema.value.readonly).toBe(true)
  })

  it("effectiveSchema 应包含 label 供 validation 错误消息使用", () => {
    const schema = createTestSchemaForUS2({ label: "邮箱地址" })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "email" as any, schema },
    })

    expect(state.effectiveSchema.value.label).toBe("邮箱地址")
  })
})
