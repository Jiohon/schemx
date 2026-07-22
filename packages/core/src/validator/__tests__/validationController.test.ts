import { describe, expect, it, vi } from "vitest"

import * as Core from "../../index"
import { createValidationRuleRegistry } from "../../registry"
import { createValidator } from "../validator"
import { createValidationController } from "../validationController"

import type { AdapterRule, ValidationAdapter, ValidationRule } from "../types"

interface FormValues {
  email: string
}

const nativeRule: ValidationRule = {
  validate: () => ({ valid: true as const }),
}

function createTestAdapter<TInput>(
  id: string,
  resolve: (rule: AdapterRule | TInput) => readonly ValidationRule[]
): ValidationAdapter<TInput> {
  const rules = new WeakSet<object>()

  return {
    id,
    rule(input) {
      const rule = Object.freeze({ adapterId: id, payload: input })
      rules.add(rule)
      return rule
    },
    isRule(value): value is AdapterRule {
      return typeof value === "object" && value !== null && rules.has(value)
    },
    resolve: resolve as ValidationAdapter<TInput>["resolve"],
  }
}

const fieldConfig = {
  name: "email" as const,
  label: "邮箱",
  required: false as const,
  rules: undefined,
}

describe("ValidationController", () => {
  it("不从 Core 公共入口导出品牌规则工厂", () => {
    expect("createAdapterRule" in Core).toBe(false)
  })

  it("required 始终排在附加规则之前", async () => {
    const validator = createValidator<FormValues>()
    const controller = createValidationController({
      validator,
      registry: createValidationRuleRegistry(),
    })
    const extra = vi.fn(() => ({
      valid: false as const,
      issues: [{ message: "格式错误" }],
    }))

    controller.syncField({
      name: "email",
      label: "邮箱",
      required: true,
      rules: [{ validate: extra }],
    })

    await expect(validator.validateField("email", { email: "" })).resolves.toMatchObject({
      errors: [{ issues: [{ message: "邮箱为必填项", code: "required" }] }],
    })
    expect(extra).not.toHaveBeenCalled()
  })

  it("未注册名称写入字段配置错误，并在注册后自动恢复", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const validator = createValidator<FormValues>()
    const registry = createValidationRuleRegistry()
    const controller = createValidationController({
      validator,
      registry,
    })

    controller.syncField({ name: "email", label: "邮箱", required: false, rules: ["missing"] })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('[schemx] 未找到名为 "missing" 的校验规则')
    await expect(validator.validateField("email", { email: "x" })).resolves.toMatchObject({
      errors: [{ issues: [{ code: "validation_config" }] }],
    })
    registry.register("missing", { validate: () => ({ valid: true }) })
    await expect(validator.validateField("email", { email: "x" })).resolves.toEqual({
      valid: true,
      values: { email: "x" },
      errors: [],
    })
    warn.mockRestore()
  })

  it("移除字段时同步清理规则和错误", () => {
    const validator = createValidator<FormValues>()
    const controller = createValidationController({
      validator,
      registry: createValidationRuleRegistry(),
    })

    controller.syncField({ name: "email", label: "邮箱", required: true, rules: undefined })
    validator.setFieldErrors("email", ["旧错误"])
    controller.removeField("email")

    expect(validator.getFieldErrors("email")).toEqual([])
  })

  it("按品牌 adapter 解析并执行规则", async () => {
    const adapter = createTestAdapter("test", (rule) => [
      {
        validate: () =>
          rule.payload === "invalid"
            ? { valid: false as const, issues: [{ message: "无效" }] }
            : { valid: true as const },
      },
    ])
    const validator = createValidator<FormValues>()
    const controller = createValidationController({
      validator,
      registry: createValidationRuleRegistry(),
      adapters: [adapter],
    })

    controller.syncField({ ...fieldConfig, rules: adapter.rule("invalid") })

    await expect(validator.validateField("email", { email: "x" })).resolves.toMatchObject({
      errors: [{ issues: [{ message: "无效" }] }],
    })
  })

  it("不将手写同形对象识别为品牌 adapter 规则并警告跳过", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const adapter = createTestAdapter("test", () => [nativeRule])
    const controller = createValidationController({
      validator: createValidator<FormValues>(),
      registry: createValidationRuleRegistry(),
      adapters: [adapter],
    })

    controller.syncField({
      ...fieldConfig,
      rules: { adapterId: "test", payload: "value" } as never,
    })

    expect(warn).toHaveBeenCalledWith('[schemx] 字段 "email" 存在无法识别的校验规则，已跳过')
    warn.mockRestore()
  })

  it("裸对象规则未配置默认 adapter 时警告并跳过", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const controller = createValidationController({
      validator: createValidator<FormValues>(),
      registry: createValidationRuleRegistry(),
      adapters: [],
    })

    controller.syncField({ ...fieldConfig, rules: { required: true } as never })

    expect(warn).toHaveBeenCalledWith('[schemx] 字段 "email" 存在无法识别的校验规则，已跳过')
    warn.mockRestore()
  })

  it("Standard Schema 经内置 adapter 校验失败", async () => {
    const validator = createValidator<FormValues>()
    const controller = createValidationController({
      validator,
      registry: createValidationRuleRegistry(),
    })
    const schema = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => ({ issues: [{ message: "ss 失败" }] }),
      },
    }

    controller.syncField({ ...fieldConfig, rules: [schema] as never })

    await expect(validator.validateField("email", { email: "x" })).resolves.toMatchObject({
      errors: [{ issues: [{ message: "ss 失败" }] }],
    })
  })

  it("未识别对象规则写入配置错误，不执行部分规则", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const extra = vi.fn(() => ({
      valid: false as const,
      issues: [{ message: "格式错误" }],
    }))
    const validator = createValidator<FormValues>()
    const controller = createValidationController({
      validator,
      registry: createValidationRuleRegistry(),
    })

    controller.syncField({
      ...fieldConfig,
      rules: [{ validate: extra }, { foo: "bar" }] as never,
    })

    await expect(validator.validateField("email", { email: "x" })).resolves.toMatchObject({
      errors: [{ issues: [{ code: "validation_config" }] }],
    })
    expect(extra).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it("同一字段的未识别对象规则仅警告一次", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const controller = createValidationController({
      validator: createValidator<FormValues>(),
      registry: createValidationRuleRegistry(),
    })

    controller.syncField({ ...fieldConfig, rules: [{ foo: "bar" }] as never })
    controller.syncField({ ...fieldConfig, rules: [{ foo: "bar" }] as never })

    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it("非法 adapter 返回值写入字段配置错误", async () => {
    const badAdapter = createTestAdapter("bad", () => [{}] as never)
    const validator = createValidator<FormValues>()
    const controller = createValidationController({
      validator,
      registry: createValidationRuleRegistry(),
      adapters: [badAdapter],
    })

    expect(controller.syncField({ ...fieldConfig, rules: badAdapter.rule(null) })).toBe(false)
    await expect(validator.validateField("email", { email: "x" })).resolves.toMatchObject({
      errors: [{ issues: [{ code: "validation_config" }] }],
    })
  })

  it("拒绝重复 adapter id", () => {
    expect(() =>
      createValidationController({
        validator: createValidator<FormValues>(),
        registry: createValidationRuleRegistry(),
        adapters: [
          createTestAdapter("same", () => [nativeRule]),
          createTestAdapter("same", () => [nativeRule]),
        ],
      })
    ).toThrow('重复的校验 adapter id "same"')
  })

  it("同一规则匹配多个 adapter 时写入配置错误", async () => {
    const first = createTestAdapter("first", () => [nativeRule])
    const second = createTestAdapter("second", () => [nativeRule])
    const validator = createValidator<FormValues>()
    const sharedRule = { marker: true }
    const alwaysMatches = (adapter: ValidationAdapter) => ({
      ...adapter,
      isRule: (value: unknown): value is AdapterRule => value === sharedRule,
    })
    const controller = createValidationController({
      validator,
      registry: createValidationRuleRegistry(),
      adapters: [alwaysMatches(first), alwaysMatches(second)],
    })

    expect(controller.syncField({ ...fieldConfig, rules: sharedRule as never })).toBe(false)
    await expect(validator.validateField("email", { email: "x" })).resolves.toMatchObject({
      errors: [{ issues: [{ code: "validation_config" }] }],
    })
    controller.destroy()
  })

  it.each([null, 1, {}, "   "])("拒绝非法 adapter id %j", (id) => {
    expect(() =>
      createValidationController({
        validator: createValidator<FormValues>(),
        registry: createValidationRuleRegistry(),
        adapters: [
          {
            id,
            rule: () => ({ adapterId: "test", payload: null }),
            isRule: () => false,
            resolve: () => [nativeRule],
          } as never,
        ],
      })
    ).toThrow("校验 adapter id 必须为非空字符串")
  })

  it("保留 adapter id 与内置 adapter 冲突时抛错", () => {
    const adapter = createTestAdapter("standard-schema", () => [nativeRule])
    expect(() =>
      createValidationController({
        validator: createValidator<FormValues>(),
        registry: createValidationRuleRegistry(),
        adapters: [adapter],
      })
    ).toThrow('重复的校验 adapter id "standard-schema"')
  })
})
