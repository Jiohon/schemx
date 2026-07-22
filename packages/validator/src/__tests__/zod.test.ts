import { describe, expect, it } from "vitest"
import { z } from "zod"
import { z as z3 } from "zod/v3"

import { createZodAdapter, type ZodRuleInput } from "../zod"

import type { AdapterRule } from "@schemx/core"

const context = {
  name: "email" as const,
  values: { email: "invalid" },
  signal: new AbortController().signal,
}

/**
 * 解析规则并执行返回的原生规则，等价于此前直接调用 adapter.validate。
 *
 * resolve 接收构建期 FieldValidationConfig（仅用 name），返回的规则 validate
 * 接收运行期 ValidationRuleContext（含 values 与 signal）。
 */
async function run(
  adapter: ReturnType<typeof createZodAdapter>,
  input: AdapterRule | ZodRuleInput,
  value: unknown,
  ctx: typeof context
) {
  const rules = adapter.resolve(input, {
    name: ctx.name,
    label: "",
    required: undefined,
    rules: undefined,
  })

  return rules[0].validate(value, ctx)
}

describe("createZodAdapter", () => {
  it("仅将本实例创建的规则识别为品牌规则", () => {
    const adapter = createZodAdapter()
    const rule = adapter.rule(z.string().email())

    expect(adapter.isRule(rule)).toBe(true)
    expect(adapter.isRule({ adapterId: "zod", payload: rule.payload })).toBe(false)
  })

  it("将 Zod issue 映射为原生校验结果", async () => {
    const adapter = createZodAdapter()

    await expect(
      run(adapter, { schema: z.string().email() }, "invalid", context)
    ).resolves.toEqual({
      valid: false,
      issues: [{ message: "Invalid email address", code: "invalid_format" }],
    })
  })

  it("允许单条规则自定义 issue 映射", async () => {
    const adapter = createZodAdapter()
    const input: ZodRuleInput = {
      schema: z.string().email(),
      options: {
        mapIssue: (issue) => ({ message: `邮箱错误：${issue.code}` }),
      },
    }

    await expect(run(adapter, input, "invalid", context)).resolves.toEqual({
      valid: false,
      issues: [{ message: "邮箱错误：invalid_format" }],
    })
  })

  it("兼容 Zod 3 的公开 safeParseAsync 协议", async () => {
    const adapter = createZodAdapter()

    await expect(
      run(adapter, { schema: z3.string().email() }, "invalid", context)
    ).resolves.toMatchObject({
      valid: false,
      issues: [{ message: expect.any(String), code: "invalid_string" }],
    })
  })

  it("不将其他实例或手写对象识别为品牌规则", () => {
    const adapter = createZodAdapter()
    const anotherAdapter = createZodAdapter()
    const schema = z.string()
    expect(adapter.isRule(anotherAdapter.rule(schema))).toBe(false)
    expect(adapter.isRule({ adapterId: "zod", payload: schema })).toBe(false)
  })

  it("拒绝其他实例创建的品牌规则", () => {
    const adapter = createZodAdapter()
    const foreignRule = createZodAdapter().rule(z.string().email())

    expect(() =>
      adapter.resolve(foreignRule, {
        name: "email",
        label: "",
        required: undefined,
        rules: undefined,
      })
    ).toThrow("仅接受由当前实例创建的规则")
  })

  it("从本实例品牌规则的 payload 读取 schema 与选项", async () => {
    const adapter = createZodAdapter()
    const rule = adapter.rule(z.string().email(), {
      mapIssue: () => ({ message: "邮箱格式不正确" }),
    })

    await expect(run(adapter, rule, "invalid", context)).resolves.toEqual({
      valid: false,
      issues: [{ message: "邮箱格式不正确" }],
    })
  })

  it("在开始前或异步解析期间中止时不返回陈旧结果", async () => {
    const adapter = createZodAdapter()
    const before = new AbortController()
    before.abort()
    const during = new AbortController()
    const delayedSchema = {
      safeParseAsync: () =>
        new Promise<{ readonly success: false; readonly error: { readonly issues: [] } }>(
          (resolve) =>
            setTimeout(() => resolve({ success: false, error: { issues: [] } }), 10)
        ),
    }
    const pending = run(adapter, { schema: delayedSchema }, "invalid", {
      ...context,
      signal: during.signal,
    })
    during.abort()

    await expect(
      run(adapter, { schema: z.string().email() }, "invalid", {
        ...context,
        signal: before.signal,
      })
    ).resolves.toEqual({ valid: true })
    await expect(pending).resolves.toEqual({ valid: true })
  })
})
