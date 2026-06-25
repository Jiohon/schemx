import { describe, expect, it } from "vitest"
import {
  createFieldRuntimeState,
  setFieldStaticSchema,
  setFieldDynamicOverrides,
  resetFieldDynamicOverrides,
} from "../runtimeState"

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

describe("FieldRuntimeState", () => {
  describe("createFieldRuntimeState", () => {
    it("应该创建包含所有层次的字段运行态", () => {
      const schema = createTestSchema()
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "username" as any,
          schema,
        },
      })

      expect(state.staticSchema).toBeDefined()
      expect(state.dynamicOverrides).toBeDefined()
      expect(state.effectiveSchema).toBeDefined()
      expect(state.viewSchema).toBeDefined()
      expect(state.diagnostics).toBeDefined()
    })

    it("初始 staticSchema 应该等于 descriptor.schema", () => {
      const schema = createTestSchema({ label: "用户名" })
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "username" as any,
          schema,
        },
      })

      expect(state.staticSchema.value).toEqual(schema)
    })

    it("初始 dynamicOverrides 应该为空对象", () => {
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "username" as any,
          schema: createTestSchema(),
        },
      })

      expect(state.dynamicOverrides.value).toEqual({})
    })

    it("初始 diagnostics 来源应为 static-schema", () => {
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "username" as any,
          schema: createTestSchema(),
        },
      })

      expect(state.diagnostics.value.lastUpdatedBy).toBe("static-schema")
      expect(state.diagnostics.value.version).toBe(0)
    })
  })

  describe("effectiveSchema", () => {
    it("应该合并静态 schema 和默认值", () => {
      const schema = createTestSchema({
        label: "邮箱",
        visible: true,
        disabled: false,
        required: true,
      })
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "email" as any,
          schema,
        },
      })

      const effective = state.effectiveSchema.value

      expect(effective.label).toBe("邮箱")
      expect(effective.visible).toBe(true)
      expect(effective.disabled).toBe(false)
      expect(effective.required).toBe(true)
    })

    it("动态覆盖应该覆盖静态 schema", () => {
      const schema = createTestSchema({ visible: true, disabled: false })
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "email" as any,
          schema,
        },
      })

      setFieldDynamicOverrides(state, { visible: false, disabled: true }, {
        source: "dependencies",
        triggerFields: ["country" as any],
      })

      const effective = state.effectiveSchema.value

      expect(effective.visible).toBe(false)
      expect(effective.disabled).toBe(true)
    })

    it("部分动态覆盖不应影响未覆盖的静态属性", () => {
      const schema = createTestSchema({ visible: true, disabled: false, readonly: false })
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "email" as any,
          schema,
        },
      })

      setFieldDynamicOverrides(state, { disabled: true }, {
        source: "dependencies",
        triggerFields: ["country" as any],
      })

      const effective = state.effectiveSchema.value

      expect(effective.visible).toBe(true) // 未覆盖
      expect(effective.disabled).toBe(true) // 已覆盖
      expect(effective.readonly).toBe(false) // 未覆盖
    })
  })

  describe("setFieldStaticSchema", () => {
    it("应该更新 staticSchema", () => {
      const schema = createTestSchema({ label: "旧标签" })
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "email" as any,
          schema,
        },
      })

      const newSchema = createTestSchema({ label: "新标签" })
      setFieldStaticSchema(state, {
        name: "email" as any,
        schema: newSchema,
      })

      expect(state.staticSchema.value.label).toBe("新标签")
    })

    it("更新 staticSchema 不应清空 dynamicOverrides", () => {
      const schema = createTestSchema({ visible: true })
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "email" as any,
          schema,
        },
      })

      setFieldDynamicOverrides(state, { visible: false }, {
        source: "dependencies",
        triggerFields: ["country" as any],
      })

      const newSchema = createTestSchema({ visible: true, label: "新标签" })
      setFieldStaticSchema(state, {
        name: "email" as any,
        schema: newSchema,
      })

      // dynamicOverrides 应保留
      expect(state.dynamicOverrides.value.visible).toBe(false)
      // staticSchema 应更新
      expect(state.staticSchema.value.label).toBe("新标签")
    })

    it("应该更新 diagnostics", () => {
      const schema = createTestSchema()
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "email" as any,
          schema,
        },
      })

      const prevVersion = state.diagnostics.value.version
      setFieldStaticSchema(state, {
        name: "email" as any,
        schema: createTestSchema({ label: "新" }),
      })

      expect(state.diagnostics.value.lastUpdatedBy).toBe("static-schema")
      expect(state.diagnostics.value.version).toBe(prevVersion + 1)
    })
  })

  describe("setFieldDynamicOverrides", () => {
    it("应该写入动态覆盖", () => {
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "email" as any,
          schema: createTestSchema(),
        },
      })

      setFieldDynamicOverrides(state, { placeholder: "动态占位" }, {
        source: "dependencies",
        triggerFields: ["type" as any],
      })

      expect(state.dynamicOverrides.value.placeholder).toBe("动态占位")
    })

    it("应该更新 diagnostics 记录来源和触发字段", () => {
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "email" as any,
          schema: createTestSchema(),
        },
      })

      setFieldDynamicOverrides(state, { visible: false }, {
        source: "dependencies",
        triggerFields: ["country" as any, "city" as any],
      })

      const diag = state.diagnostics.value
      expect(diag.lastUpdatedBy).toBe("dependencies")
      expect(diag.triggerFields).toEqual(["country", "city"])
      expect(diag.overriddenKeys).toContain("visible")
    })

    it("空对象表示当前没有动态覆盖", () => {
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "email" as any,
          schema: createTestSchema(),
        },
      })

      setFieldDynamicOverrides(state, { visible: false }, {
        source: "dependencies",
        triggerFields: ["country" as any],
      })
      setFieldDynamicOverrides(state, {}, {
        source: "dependencies",
        triggerFields: [],
      })

      expect(state.dynamicOverrides.value).toEqual({})
    })
  })

  describe("resetFieldDynamicOverrides", () => {
    it("应该清空 dynamicOverrides", () => {
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "email" as any,
          schema: createTestSchema(),
        },
      })

      setFieldDynamicOverrides(state, { visible: false }, {
        source: "dependencies",
        triggerFields: ["country" as any],
      })
      resetFieldDynamicOverrides(state, "reset")

      expect(state.dynamicOverrides.value).toEqual({})
    })

    it("应该更新 diagnostics", () => {
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "email" as any,
          schema: createTestSchema(),
        },
      })

      setFieldDynamicOverrides(state, { visible: false }, {
        source: "dependencies",
        triggerFields: ["country" as any],
      })
      resetFieldDynamicOverrides(state, "dispose")

      expect(state.diagnostics.value.lastUpdatedBy).toBe("dispose")
    })

    it("不应修改 staticSchema", () => {
      const schema = createTestSchema({ label: "原始标签" })
      const state = createFieldRuntimeState({
        nodeId: 1,
        key: "field-1",
        descriptor: {
          name: "email" as any,
          schema,
        },
      })

      setFieldDynamicOverrides(state, { visible: false }, {
        source: "dependencies",
        triggerFields: ["country" as any],
      })
      resetFieldDynamicOverrides(state)

      expect(state.staticSchema.value.label).toBe("原始标签")
    })
  })
})

describe("effectiveSchema 合并逻辑 (US1)", () => {
  it("应该合并静态 schema、动态覆盖和默认值", () => {
    const schema = createTestSchema({
      label: "邮箱",
      visible: true,
      disabled: false,
      readonly: false,
      required: false,
      placeholder: "请输入邮箱",
      componentProps: { type: "email" } as any,
      rules: [{ required: true }] as any,
    })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "email" as any, schema },
    })

    const effective = state.effectiveSchema.value

    expect(effective.key).toBe("field-1")
    expect(effective.name).toBe("email")
    expect(effective.componentType).toBe("input")
    expect(effective.label).toBe("邮箱")
    expect(effective.visible).toBe(true)
    expect(effective.disabled).toBe(false)
    expect(effective.readonly).toBe(false)
    expect(effective.required).toBe(false)
    expect(effective.placeholder).toBe("请输入邮箱")
    expect(effective.componentProps).toEqual({ type: "email" })
    expect(effective.rules).toEqual([{ required: true }])
    expect(effective.validationTrigger).toBe("onChange")
  })

  it("动态覆盖 rules 应覆盖静态 rules", () => {
    const schema = createTestSchema({ rules: [{ required: true }] as any })
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

  it("动态覆盖 componentProps 应覆盖静态 componentProps", () => {
    const schema = createTestSchema({ componentProps: { size: "small" } as any })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "email" as any, schema },
    })

    setFieldDynamicOverrides(state, { componentProps: { size: "large" } as any }, {
      source: "dependencies",
      triggerFields: ["type" as any],
    })

    expect(state.effectiveSchema.value.componentProps).toEqual({ size: "large" })
  })

  it("viewSchema 应该反映 effectiveSchema 的合并结果", () => {
    const schema = createTestSchema({ visible: true, label: "原始" })
    const state = createFieldRuntimeState({
      nodeId: 1,
      key: "field-1",
      descriptor: { name: "email" as any, schema },
    })

    setFieldDynamicOverrides(state, { visible: false, label: "动态" as any }, {
      source: "dependencies",
      triggerFields: ["country" as any],
    })

    const view = state.viewSchema.value
    expect(view.visible).toBe(false)
    // label 不是动态覆盖 key，应保持静态值
  })
})
