/**
 * ValidationEffect 模块测试。
 *
 * @module core/field/__tests__/validationEffect.test
 */

import { describe, expect, it, vi } from "vitest"

import { createRuntimeScope } from "../../graph/scope"
import { createReactiveEffect, createSignal } from "../../reactivity"
import { createFieldModel } from "../model"
import { createRuntimeScheduler } from "../../scheduler"
import { createValidationEffect } from "../validationEffect"

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
  kind: "field",
  key: "field:0:field",
  schema,
  validation: {
    rules: schema.rules,
  },
})

const createContext = (
  options: {
    validateResult?: ValidateResult<TestValues>
  } = {}
) => {
  const scheduler = createRuntimeScheduler()
  const validator = {
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

  const rulesRegistry = {
    resolveRuleBySchema: vi.fn(() => ["resolved-rule"]),
  }

  const store = {
    getFieldsSnapshot: vi.fn(() => ({ field: "value" })),
  }

  return {
    context: {
      validator,
      rulesRegistry,
      store,
      scheduler,
    } as unknown as SchemxFormContext<TestValues>,
    validator,
    rulesRegistry,
    store,
    scheduler,
  }
}

describe("createValidationEffect", () => {
  it("应该创建 ValidationEffect 并注册规则", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor()
    const { context, validator, rulesRegistry, scheduler } = createContext()

    const validation = createValidationEffect({
      props: createSignal(descriptor.schema),
      descriptor,
      scope,
      context,
    })

    await scheduler.flush()

    expect(validation.registered.value).toBe(true)
    expect(validation.validating.value).toBe(false)
    expect(rulesRegistry.resolveRuleBySchema).toHaveBeenCalledWith(descriptor.schema)
    expect(validator.registerRules).toHaveBeenCalledWith(
      "field",
      ["resolved-rule"],
      "字段为必填项"
    )
  })
})

describe("rule management", () => {
  it("应该在 visible=false 时从 Validator 注销规则并清空错误", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(createSchema({ visible: false }))
    const { context, validator, scheduler } = createContext()

    createValidationEffect({
      props: createSignal(descriptor.schema),
      descriptor,
      scope,
      context,
    })

    await scheduler.flush()

    expect(validator.unregisterRules).toHaveBeenCalledWith("field")
    expect(validator.setFieldError).toHaveBeenCalledWith("field", [])
  })

  it("应该在 readonly=true 时从 Validator 注销规则并清空错误", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(createSchema({ readonly: true }))
    const { context, validator, scheduler } = createContext()

    createValidationEffect({
      props: createSignal(descriptor.schema),
      descriptor,
      scope,
      context,
    })

    await scheduler.flush()

    expect(validator.unregisterRules).toHaveBeenCalledWith("field")
    expect(validator.setFieldError).toHaveBeenCalledWith("field", [])
  })

  it("应该在 disabled=true 时从 Validator 注销规则并清空错误", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor(createSchema({ disabled: true }))
    const { context, validator, scheduler } = createContext()

    createValidationEffect({
      props: createSignal(descriptor.schema),
      descriptor,
      scope,
      context,
    })

    await scheduler.flush()

    expect(validator.unregisterRules).toHaveBeenCalledWith("field")
    expect(validator.setFieldError).toHaveBeenCalledWith("field", [])
  })

  it("字段呈现态在响应式 effect 中变化时不应同步写 Validator 造成循环", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor()
    const fieldModel = createFieldModel(descriptor)
    const trigger = createSignal(0)
    const { context, validator, scheduler } = createContext()

    createValidationEffect({
      props: createSignal(descriptor.schema),
      descriptor,
      fieldModel,
      scope,
      context,
    })

    const dispose = createReactiveEffect(() => {
      if (trigger.value > 0) {
        fieldModel.visible.value = false
      }
    })

    expect(() => {
      trigger.value = 1
    }).not.toThrow()

    await scheduler.flush()

    expect(validator.unregisterRules).toHaveBeenCalledWith("field")

    dispose()
  })
})

describe("validate method", () => {
  it("应该通过 Validator 校验 Store 快照", async () => {
    const scope = createRuntimeScope()
    const descriptor = createDescriptor()
    const { context, validator, store } = createContext()

    const validation = createValidationEffect({
      props: createSignal(descriptor.schema),
      descriptor,
      scope,
      context,
    })

    const result = await validation.validate()

    expect(result).toEqual({ ok: true, values: { field: "value" } })
    expect(store.getFieldsSnapshot).toHaveBeenCalled()
    expect(validator.validateField).toHaveBeenCalledWith("field", {
      field: "value",
    })
  })
})
