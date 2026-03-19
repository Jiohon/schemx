/**
 * 调试测试：模拟动态 visible 字段的 error effect 追踪问题
 *
 * 复现场景：
 * 1. 创建 form，注册 rules
 * 2. 延迟创建 error effect（模拟动态 visible 字段延迟挂载）
 * 3. 调用 validate → 校验失败 → errors.set 创建新 key
 * 4. 验证 effect 是否被触发
 */
import { describe, it, expect, vi } from "vitest"
import { effect } from "@preact/signals-core"
import { SignalMap } from "../signalMap"
import { createValidator } from "../validator"
import { createFormInstance } from "../createForm"
import * as z from "zod"

describe("debug: 动态 visible 字段 error effect", () => {
  it("SignalMap: effect 创建前 version 已递增，set 新 key 仍应触发 effect", () => {
    const map = new SignalMap<string, string[]>()

    // 模拟其他字段操作导致 version 递增
    map.set("fieldA", ["errorA"])
    map.set("fieldB", ["errorB"])

    // 延迟创建 effect（模拟动态 visible 字段延迟挂载）
    let effectCount = 0
    let lastValue: string[] | undefined

    const dispose = effect(() => {
      lastValue = map.get("lateField")
      effectCount++
    })

    expect(effectCount).toBe(1)
    expect(lastValue).toBeUndefined()

    // 模拟 validate: set 新 key
    map.set("lateField", ["lateError"])

    expect(effectCount).toBe(2)
    expect(lastValue).toEqual(["lateError"])

    dispose()
  })

  it("SignalMap: 中间有 delete 操作时，延迟 effect 仍应追踪新 key", () => {
    const map = new SignalMap<string, string[]>()

    // 模拟其他字段操作
    map.set("fieldA", ["errorA"])
    map.delete("fieldA") // version 再次递增

    let effectCount = 0
    let lastValue: string[] | undefined

    const dispose = effect(() => {
      lastValue = map.get("lateField")
      effectCount++
    })

    expect(effectCount).toBe(1)
    expect(lastValue).toBeUndefined()

    // 模拟 validate 中其他字段的 set（已有 key，不 version++）
    map.set("fieldA", ["newErrorA"]) // 新 key，version++

    // lateField 的 effect 应该被触发（因为 version 变了）
    const countAfterOtherSet = effectCount

    // 现在 set lateField
    map.set("lateField", ["lateError"])

    expect(lastValue).toEqual(["lateError"])

    dispose()
  })

  it("Validator: 延迟注册的字段，validate 后 getFieldError 应返回错误", async () => {
    const validator = createValidator<{ name: string; lateName: string }>()

    // 先注册一个普通字段
    const nameSchema = z.string().min(1, "名称不能为空")
    validator.registerRules("name", nameSchema)

    // 延迟注册（模拟动态 visible 字段延迟挂载后注册 rules）
    const lateSchema = z.string().min(2, "至少2个字符")
    validator.registerRules("lateName", lateSchema)

    // 创建 error effect（模拟 useField 的 disposeErrorEffect）
    let effectCount = 0
    let lastError: string[] | undefined

    const dispose = effect(() => {
      lastError = validator.getFieldError("lateName")
      effectCount++
    })

    expect(effectCount).toBe(1)
    expect(lastError).toBeUndefined()

    // 校验所有字段
    const result = await validator.validate({ name: "", lateName: "" })

    expect(result.ok).toBe(false)

    // 关键断言：effect 应该被触发，lastError 应该有值
    console.log("effectCount:", effectCount, "lastError:", lastError)
    expect(effectCount).toBeGreaterThan(1)
    expect(lastError).toBeDefined()
    expect(lastError!.length).toBeGreaterThan(0)

    dispose()
  })

  it("createFormInstance: 延迟创建的 error effect 应在 validate 后触发", async () => {
    const form = createFormInstance<{ userType: string; companyName: string }>({
      initialValues: { userType: "enterprise", companyName: "" },
    })

    // 注册 rules
    const companySchema = z.string().min(2, "企业名称至少2个字符")
    form.registerRules("companyName", companySchema, "请输入企业名称")

    // 延迟创建 error effect（模拟动态 visible 字段延迟挂载）
    let effectCount = 0
    let lastError: string[] | undefined

    const dispose = form.effect(() => {
      lastError = form.getFieldError("companyName")
      effectCount++
    })

    expect(effectCount).toBe(1)
    expect(lastError).toBeUndefined()

    // 提交校验
    const result = await form.validate()

    console.log("effectCount:", effectCount, "lastError:", lastError, "result:", result)

    // 关键断言
    expect(effectCount).toBeGreaterThan(1)
    expect(lastError).toBeDefined()
    expect(lastError!.length).toBeGreaterThan(0)

    dispose()
    form.destroy()
  })

  it("createFormInstance + onValuesChange: 模拟 DynamicForm 完整场景", async () => {
    const onValuesChange = vi.fn()

    const form = createFormInstance<{
      userType: string
      companyName: string
      businessLicense: string
    }>({
      initialValues: { userType: "", companyName: "", businessLicense: "" },
      onValuesChange,
    })

    // 注册 userType 的 rules
    const userTypeSchema = z.string().min(1, "请选择用户类型")
    form.registerRules("userType", userTypeSchema, "请选择用户类型")

    // 模拟用户选择 enterprise
    form.setFieldValue("userType", "enterprise")

    // 模拟动态 visible 字段延迟挂载后注册 rules
    const companySchema = z.string().min(2, "企业名称至少2个字符")
    form.registerRules("companyName", companySchema, "请输入企业名称")

    const licenseSchema = z.string().min(15, "请输入有效的营业执照号")
    form.registerRules("businessLicense", licenseSchema, "请输入营业执照号")

    // 创建 error effect（模拟 useField 的 disposeErrorEffect）
    let companyErrorCount = 0
    let companyLastError: string[] | undefined

    const disposeCompanyError = form.effect(() => {
      companyLastError = form.getFieldError("companyName")
      companyErrorCount++
    })

    let licenseErrorCount = 0
    let licenseLastError: string[] | undefined

    const disposeLicenseError = form.effect(() => {
      licenseLastError = form.getFieldError("businessLicense")
      licenseErrorCount++
    })

    expect(companyErrorCount).toBe(1)
    expect(companyLastError).toBeUndefined()
    expect(licenseErrorCount).toBe(1)
    expect(licenseLastError).toBeUndefined()

    // 提交校验（模拟点击提交按钮）
    const result = await form.validate()

    console.log("company:", companyErrorCount, companyLastError)
    console.log("license:", licenseErrorCount, licenseLastError)
    console.log("result:", result)

    // 关键断言：两个延迟字段的 error effect 都应该被触发
    expect(companyErrorCount).toBeGreaterThan(1)
    expect(companyLastError).toBeDefined()
    expect(companyLastError!.length).toBeGreaterThan(0)

    expect(licenseErrorCount).toBeGreaterThan(1)
    expect(licenseLastError).toBeDefined()
    expect(licenseLastError!.length).toBeGreaterThan(0)

    disposeCompanyError()
    disposeLicenseError()
    form.destroy()
  })
})
