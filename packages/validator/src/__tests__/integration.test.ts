import { configureSchemx, createForm } from "@schemx/core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { createAsyncValidatorAdapter } from "../async-validator"
import { createZodAdapter } from "../zod"

// 模块级 adapter 实例：同一实例用于 rule() 与 createForm 注册，品牌才被认领。
const zod = createZodAdapter()
const av = createAsyncValidatorAdapter()

beforeEach(() => {
  // 重置全局校验配置，确保集成只依赖下面每个 form 显式传入的 adapters。
  configureSchemx({})
})

describe("@schemx/validator × core 集成", () => {
  it("zod.rule 品牌规则经 createForm 校验失败", async () => {
    const form = createForm({
      initialValues: { email: "invalid" },
      adapters: [zod, av],
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [zod.rule(z.string().email("邮箱格式错误"))],
        },
      ],
    })

    await expect(form.validate()).resolves.toMatchObject({
      valid: false,
      errors: [{ scope: "field", name: "email", issues: [{ message: "邮箱格式错误" }] }],
    })
    form.destroy()
  })

  it("asyncValidator.rule 品牌规则经 createForm 校验失败", async () => {
    const form = createForm({
      initialValues: { email: "invalid" },
      adapters: [zod, av],
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [av.rule({ type: "email", message: "async 邮箱格式错误" })],
        },
      ],
    })

    await expect(form.validate()).resolves.toMatchObject({
      valid: false,
      errors: [
        { scope: "field", name: "email", issues: [{ message: "async 邮箱格式错误" }] },
      ],
    })
    form.destroy()
  })

  it("async-validator 必填 descriptor 品牌规则经 createForm 校验失败", async () => {
    const form = createForm({
      initialValues: { email: "" },
      adapters: [zod, av],
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [av.rule({ required: true, message: "必填" })],
        },
      ],
    })

    await expect(form.validate()).resolves.toMatchObject({
      valid: false,
      errors: [{ scope: "field", name: "email", issues: [{ message: "必填" }] }],
    })
    form.destroy()
  })

  it("Standard Schema 直通不经 adapter", async () => {
    const form = createForm({
      initialValues: { email: "invalid" },
      adapters: [zod, av],
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [z.string().email("ss 邮箱格式错误")],
        },
      ],
    })

    await expect(form.validate()).resolves.toMatchObject({
      valid: false,
      errors: [{ scope: "field", name: "email", issues: [{ message: "ss 邮箱格式错误" }] }],
    })
    form.destroy()
  })

  it("同一字段混用三种写法并按顺序聚合 issue", async () => {
    const form = createForm({
      initialValues: { email: "invalid" },
      adapters: [zod, av],
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [
            zod.rule(z.string().email("zod-msg")),
            av.rule({ type: "email", message: "av-msg" }),
            z.string().email("ss-msg"),
          ],
        },
      ],
    })

    const result = await form.validate()
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.issues).toMatchObject([
      { message: "zod-msg" },
      { message: "av-msg" },
      { message: "ss-msg" },
    ])
    form.destroy()
  })

  it("跨实例品牌不互认", () => {
    const anotherZod = createZodAdapter()
    expect(zod.isRule(anotherZod.rule(z.string()))).toBe(false)
    expect(anotherZod.isRule(zod.rule(z.string()))).toBe(false)
  })

  it("合法值通过校验", async () => {
    const form = createForm({
      initialValues: { email: "a@b.com" },
      adapters: [zod, av],
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [zod.rule(z.string().email("邮箱格式错误"))],
        },
      ],
    })

    await expect(form.validate()).resolves.toMatchObject({ valid: true })
    form.destroy()
  })

  it("submit 返回校验结果并在成功时回调 onFinish", async () => {
    const onFinish = vi.fn()
    const form = createForm({
      initialValues: { email: "a@b.com" },
      adapters: [zod, av],
      schemas: [
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          rules: [zod.rule(z.string().email("邮箱格式错误"))],
        },
      ],
      onFinish,
    })

    await expect(form.submit()).resolves.toMatchObject({ valid: true })
    expect(onFinish).toHaveBeenCalled()
    form.destroy()
  })
})
