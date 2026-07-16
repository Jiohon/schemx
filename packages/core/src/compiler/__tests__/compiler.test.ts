/**
 * Schema 编译器单元测试。
 *
 * @module core/field/__tests__/compiler.test
 */

import { describe, expect, it, vi } from "vitest"

import { createCompile, CompileError } from "../index"
import { createDescriptor } from "../../descriptor"

import type { SchemxField } from "../../types/schema"

// 验证 createCompile().toDescriptors 对基础字段、分组、dependency、规则、属性等的编译正确性
describe("createCompile().toDescriptors", () => {
  it("应该允许 createDescriptor 通过显式参数读取表单默认配置", () => {
    const descriptor = createDescriptor(
      {
        name: "username",
        label: "用户名",
        componentType: "input",
      },
      0,
      "",
      {
        defaultProps: {
          readonly: true,
        },
        instance: {
          marker: "form",
        } as any,
      }
    )

    expect(descriptor.type).toBe("field")
    if (descriptor.type === "field") {
      expect(descriptor.staticSchema.readonly).toBe(true)
      expect(descriptor.staticSchema.componentProps?.formInstance).toEqual({
        marker: "form",
      })
    }
  })

  it("应该编译基础字段 schema", () => {
    const schemas: SchemxField[] = [
      {
        name: "username",
        label: "用户名",
        componentType: "input",
        placeholder: "请输入用户名",
      },
    ]

    const descriptors = createCompile().toDescriptors(schemas)

    expect(descriptors).toHaveLength(1)
    expect(descriptors[0].type).toBe("field")
    if (descriptors[0].type === "field") {
      expect(descriptors[0].staticSchema.name).toBe("username")
      expect(descriptors[0].staticSchema.componentType).toBe("input")
      expect(descriptors[0].staticSchema.placeholder).toBe("请输入用户名")
      expect(descriptors[0].staticSchema).not.toHaveProperty("initialValue")
    }
  })

  it("编译时不应向调用方传入的 schema 写入生成 key", () => {
    const schema: SchemxField = {
      name: "username",
      label: "用户名",
      componentType: "input",
    }

    const [descriptor] = createCompile().toDescriptors([schema])

    expect(descriptor.key).toBe("field:username")
    expect(schema).not.toHaveProperty("key")
  })

  it("应该保留显式配置的空 placeholder", () => {
    const schemas: SchemxField[] = [
      {
        name: "username",
        label: "用户名",
        componentType: "input",
        placeholder: "",
      },
    ]

    const descriptors = createCompile().toDescriptors(schemas)

    if (descriptors[0].type === "field") {
      expect(descriptors[0].staticSchema.placeholder).toBe("")
    }
  })

  it("应该编译分组 schema", () => {
    const schemas: SchemxField[] = [
      {
        label: "基本信息",
        children: [
          { name: "name", label: "姓名", componentType: "input" },
          { name: "age", label: "年龄", componentType: "number" },
        ],
      },
    ]

    const descriptors = createCompile().toDescriptors(schemas)

    expect(descriptors).toHaveLength(1)
    expect(descriptors[0].type).toBe("group")
    if (descriptors[0].type === "group") {
      expect(descriptors[0].children).toHaveLength(2)
      expect(descriptors[0].staticSchema).not.toHaveProperty("componentType")
      expect(descriptors[0].children[0].type).toBe("field")
      expect(descriptors[0].children[1].type).toBe("field")
    }
  })

  it("应该编译 dependency schema", () => {
    const schemas: SchemxField[] = [
      {
        to: ["user", "type"],
        renderer: () => [{ name: "extra", label: "Extra", componentType: "input" }],
      },
    ]

    const descriptors = createCompile().toDescriptors(schemas)

    expect(descriptors).toHaveLength(1)
    expect(descriptors[0].type).toBe("dependency")
    if (descriptors[0].type === "dependency") {
      expect(descriptors[0].triggerFields).toEqual(["user", "type"])
    }
  })

  it("应该把 group 和 dependency 作为普通 Renderer key 编译", () => {
    const schemas: SchemxField[] = [
      { name: "groupRenderer", label: "Group Renderer", componentType: "group" },
      {
        name: "dependencyRenderer",
        label: "Dependency Renderer",
        componentType: "dependency",
      },
    ]

    const descriptors = createCompile().toDescriptors(schemas)

    expect(descriptors.map((descriptor) => descriptor.type)).toEqual(["field", "field"])
  })

  it("旧 Group 和 Dependency 语法应该抛出可迁移的 CompileError", () => {
    const compile = createCompile()
    const legacyGroup = {
      key: "legacy-group",
      componentType: "group",
      label: "旧 Group",
      children: [],
    } as unknown as SchemxField
    const legacyDependency = {
      key: "legacy-dependency",
      componentType: "dependency",
      to: ["mode"],
      renderer: () => [],
    } as unknown as SchemxField

    expect(() => compile.toDescriptors([legacyGroup])).toThrowError(CompileError)
    expect(() => compile.toDescriptors([legacyGroup])).toThrow("请删除 componentType")
    expect(() => compile.toDescriptors([legacyDependency])).toThrowError(CompileError)
    expect(() => compile.toDescriptors([legacyDependency])).toThrow(
      "请删除 componentType"
    )

    try {
      compile.toDescriptors([legacyGroup])
    } catch (error) {
      expect(error).toBeInstanceOf(CompileError)
      expect((error as InstanceType<typeof CompileError>).schemaKey).toBe("legacy-group")
    }
  })

  it("同时匹配多种结构的 schema 应该抛出 CompileError", () => {
    const ambiguous = {
      key: "ambiguous",
      name: "ambiguous",
      label: "歧义配置",
      componentType: "input",
      children: [],
    } as unknown as SchemxField

    expect(() => createCompile().toDescriptors([ambiguous])).toThrowError(CompileError)
    expect(() => createCompile().toDescriptors([ambiguous])).toThrow("同时匹配")
  })

  it("应该处理 required 规则", () => {
    const schemas: SchemxField[] = [
      {
        name: "email",
        label: "邮箱",
        componentType: "input",
        rules: "required",
      },
    ]

    const descriptors = createCompile().toDescriptors(schemas)

    if (descriptors[0].type === "field") {
      expect(descriptors[0].staticSchema.required).toBe(true)
      expect(descriptors[0].staticSchema.rules).toEqual("required")
      expect(descriptors[0].validation?.rules).toEqual("required")
    }
  })

  it("应该处理 visible/readonly/disabled 属性", () => {
    const schemas: SchemxField[] = [
      {
        name: "secret",
        label: "Secret",
        componentType: "input",
        visible: false,
        readonly: true,
        disabled: true,
      },
    ]

    const descriptors = createCompile().toDescriptors(schemas)

    if (descriptors[0].type === "field") {
      expect(descriptors[0].staticSchema.visible).toBe(false)
      expect(descriptors[0].staticSchema.readonly).toBe(true)
      expect(descriptors[0].staticSchema.disabled).toBe(true)
    }
  })

  it("应该保留字段 schema 元数据", () => {
    const schemas: SchemxField[] = [
      {
        name: "nickname",
        label: "昵称",
        componentType: "input",
        labelIcon: "user",
        labelAlign: "left",
        labelPosition: "top",
        labelWidth: "96px",
        colon: false,
      },
    ]

    const descriptors = createCompile().toDescriptors(schemas)

    if (descriptors[0].type === "field") {
      expect(descriptors[0].staticSchema.componentType).toBe("input")
      expect(descriptors[0].staticSchema.labelIcon).toBe("user")
      expect(descriptors[0].staticSchema.labelAlign).toBe("left")
      expect(descriptors[0].staticSchema.labelPosition).toBe("top")
      expect(descriptors[0].staticSchema.labelWidth).toBe("96px")
      expect(descriptors[0].staticSchema.contentAlign).toBe("right")
      expect(descriptors[0].staticSchema.colon).toBe(false)
    }
  })

  it("应该将 contentAlign 编译为组件 align", () => {
    const schemas: SchemxField[] = [
      {
        name: "nickname",
        label: "昵称",
        componentType: "input",
        contentAlign: "center",
      },
    ]

    const descriptors = createCompile().toDescriptors(schemas)

    if (descriptors[0].type === "field") {
      expect(descriptors[0].staticSchema.contentAlign).toBe("center")
      expect(descriptors[0].staticSchema.componentProps?.align).toBe("center")
    }
  })

  it("应该在只读态强制使用详情展示布局", () => {
    const schemas: SchemxField[] = [
      {
        name: "nickname",
        label: "昵称",
        componentType: "input",
        initialValue: "Schemx",
        readonly: true,
        labelPosition: "top",
        contentAlign: "left",
        componentProps: {
          align: "left",
        },
      },
    ]

    const descriptors = createCompile().toDescriptors(schemas)

    if (descriptors[0].type === "field") {
      expect(descriptors[0].staticSchema.initialValue).toBe("Schemx")
      expect(descriptors[0].staticSchema.labelPosition).toBe("left")
      expect(descriptors[0].staticSchema.contentAlign).toBe("right")
      expect(descriptors[0].staticSchema.componentProps?.align).toBe("right")
    }
  })

  it("应该将字段扩展数据编译到规范化 schema", () => {
    const schemas: SchemxField[] = [
      {
        name: "nickname",
        label: "昵称",
        componentType: "input",
        tooltip: "公开显示的昵称",
        layout: { span: 12 },
      } as any,
    ]

    const descriptors = createCompile().toDescriptors(schemas)

    const [descriptor] = descriptors
    expect(descriptor?.type).toBe("field")

    if (descriptor?.type !== "field") {
      throw new Error("期望编译为 field descriptor")
    }

    expect(descriptor.staticSchema.tooltip).toBe("公开显示的昵称")
    expect(descriptor.staticSchema.layout).toEqual({ span: 12 })
    expect(Object.isFrozen(descriptor.staticSchema.layout)).toBe(false)
  })

  it("不应该在分组 descriptor 中保留扩展 meta", () => {
    const schemas: SchemxField[] = [
      {
        label: "基本信息",
        children: [],
        tooltip: "基础资料",
        style: { marginTop: 8 },
      } as any,
    ]

    const descriptors = createCompile().toDescriptors(schemas)

    if (descriptors[0].type === "group") {
      expect("meta" in descriptors[0]).toBe(false)
    }
  })

  it("应该生成稳定 key", () => {
    const schemas: SchemxField[] = [
      { name: "a", label: "A", componentType: "input" },
      { name: "b", label: "B", componentType: "input" },
    ]

    const run1 = createCompile().toDescriptors(schemas)
    const run2 = createCompile().toDescriptors(schemas)

    expect(run1[0].key).toBe(run2[0].key)
    expect(run1[1].key).toBe(run2[1].key)
  })

  it("key 不会因 schema 插入/删除而改变", () => {
    const before = createCompile().toDescriptors([
      { name: "a", label: "A", componentType: "input" },
      { name: "c", label: "C", componentType: "input" },
    ])

    const after = createCompile().toDescriptors([
      { name: "a", label: "A", componentType: "input" },
      { name: "b", label: "B", componentType: "input" },
      { name: "c", label: "C", componentType: "input" },
    ])

    expect(before[0].key).toBe(after[0].key)
    expect(before[1].key).toBe(after[2].key)
  })

  it("应该编译嵌套 group", () => {
    const schemas: SchemxField[] = [
      {
        label: "外层",
        children: [
          {
            label: "内层",
            children: [{ name: "deep", label: "Deep", componentType: "input" }],
          },
        ],
      },
    ]

    const descriptors = createCompile().toDescriptors(schemas)

    expect(descriptors[0].type).toBe("group")
    if (descriptors[0].type === "group") {
      expect(descriptors[0].children[0].type).toBe("group")
      if (descriptors[0].children[0].type === "group") {
        expect(descriptors[0].children[0].children[0].type).toBe("field")
      }
    }
  })

  it("应该编译混合 schema 列表", () => {
    const schemas: SchemxField[] = [
      { name: "name", label: "姓名", componentType: "input" },
      {
        label: "详情",
        children: [{ name: "email", label: "邮箱", componentType: "input" }],
      },
    ]

    const descriptors = createCompile().toDescriptors(schemas)

    expect(descriptors).toHaveLength(2)
    expect(descriptors[0].type).toBe("field")
    expect(descriptors[1].type).toBe("group")
  })

  it("应该在 name 为空时过滤该字段", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const schemas: SchemxField[] = [
      { name: "" as any, label: "Bad", componentType: "input" },
    ]

    expect(createCompile().toDescriptors(schemas)).toEqual([])
    warnSpy.mockRestore()
  })

  it("应该在 dependency 无 trigger 时过滤该节点", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const schemas: SchemxField[] = [
      {
        to: [],
        renderer: () => [],
      },
    ]

    expect(createCompile().toDescriptors(schemas)).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it("应该使用全局 readonly/disabled 默认值", () => {
    const schemas: SchemxField[] = [{ name: "f1", label: "F1", componentType: "input" }]

    const descriptors = createCompile({
      defaultProps: {
        readonly: true,
        disabled: true,
      },
    }).toDescriptors(schemas)

    if (descriptors[0].type === "field") {
      expect(descriptors[0].staticSchema.readonly).toBe(true)
      expect(descriptors[0].staticSchema.disabled).toBe(true)
    }
  })

  it("应该为未显式配置的字段合并全部表单默认属性", () => {
    const schemas: SchemxField[] = [{ name: "f1", label: "F1", componentType: "input" }]

    const descriptors = createCompile({
      defaultProps: {
        required: true,
        readonly: false,
        disabled: true,
        visible: false,
        labelIcon: "info",
        labelAlign: "center",
        labelPosition: "top",
        labelWidth: "120px",
        contentAlign: "left",
        validationTrigger: "change",
        colon: false,
      },
    }).toDescriptors(schemas)

    if (descriptors[0].type === "field") {
      expect(descriptors[0].staticSchema).toMatchObject({
        required: true,
        readonly: false,
        disabled: true,
        visible: false,
        labelIcon: "info",
        labelAlign: "center",
        labelPosition: "top",
        labelWidth: "120px",
        contentAlign: "left",
        validationTrigger: ["change"],
        colon: false,
      })
    }
  })

  it("应该保留已有的 key", () => {
    const schemas: SchemxField[] = [
      { key: "my-custom-key", name: "f1", label: "F1", componentType: "input" },
    ]

    const descriptors = createCompile().toDescriptors(schemas)
    expect(descriptors[0].key).toBe("my-custom-key")
  })
})

// 验证 createCompile 的 descriptor cache 复用与 invalidate 失效机制
describe("createCompile", () => {
  it("应该封装 descriptor cache 并在同一 schema 引用下复用 descriptor", () => {
    const compile = createCompile()
    const schemas: SchemxField[] = [
      { name: "username", label: "用户名", componentType: "input" },
    ]

    const first = compile.toDescriptors(schemas)
    const second = compile.toDescriptors(schemas)

    expect(second[0]).toBe(first[0])
  })

  it("同一 schema 引用位于不同编译位置时不应复用 descriptor", () => {
    const compile = createCompile()
    const schema: SchemxField = {
      label: "共享分组",
      children: [],
    }

    const descriptors = compile.toDescriptors([schema, schema])

    expect(descriptors[0]).not.toBe(descriptors[1])
    expect(descriptors.map((descriptor) => descriptor.key)).toEqual([
      "group:0",
      "group:1",
    ])
  })

  it("invalidate 后应该让相同 schema 引用重新生成 descriptor", () => {
    const compile = createCompile()
    const schemas: SchemxField[] = [
      { name: "username", label: "用户名", componentType: "input" },
    ]

    const first = compile.toDescriptors(schemas)

    compile.invalidate()

    const second = compile.toDescriptors(schemas)

    expect(second[0]).not.toBe(first[0])
    expect(compile.getVersion()).toBe(1)
  })
})
