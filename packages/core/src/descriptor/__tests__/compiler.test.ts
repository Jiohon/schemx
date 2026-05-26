/**
 * Schema 编译器单元测试。
 *
 * @module core/field/__tests__/compiler.test
 */

import { describe, expect, it, vi } from "vitest"

import { compileToDescriptors, CompileError } from "../compiler"

import type { SchemxField } from "../../types/schema"

describe("compileToDescriptors", () => {
  it("应该编译基础字段 schema", () => {
    const schemas: SchemxField[] = [
      {
        name: "username",
        label: "用户名",
        componentType: "input",
        placeholder: "请输入用户名",
      },
    ]

    const descriptors = compileToDescriptors(schemas)

    expect(descriptors).toHaveLength(1)
    expect(descriptors[0].type).toBe("field")
    if (descriptors[0].type === "field") {
      expect(descriptors[0].schema.name).toBe("username")
      expect(descriptors[0].schema.componentType).toBe("input")
      expect(descriptors[0].schema.placeholder).toBe("请输入用户名")
    }
  })

  it("应该编译分组 schema", () => {
    const schemas: SchemxField[] = [
      {
        label: "基本信息",
        componentType: "group",
        children: [
          { name: "name", label: "姓名", componentType: "input" },
          { name: "age", label: "年龄", componentType: "number" },
        ],
      },
    ]

    const descriptors = compileToDescriptors(schemas)

    expect(descriptors).toHaveLength(1)
    expect(descriptors[0].type).toBe("group")
    if (descriptors[0].type === "group") {
      expect(descriptors[0].children).toHaveLength(2)
      expect(descriptors[0].children[0].type).toBe("field")
      expect(descriptors[0].children[1].type).toBe("field")
    }
  })

  it("应该编译 dependency schema", () => {
    const schemas: SchemxField[] = [
      {
        componentType: "dependency",
        to: [["user", "type"]],
        renderer: () => [
          { name: "extra", label: "Extra", componentType: "input" },
        ],
      },
    ]

    const descriptors = compileToDescriptors(schemas)

    expect(descriptors).toHaveLength(1)
    expect(descriptors[0].type).toBe("dependency")
    if (descriptors[0].type === "dependency") {
      expect(descriptors[0].trigger).toEqual([["user", "type"]])
    }
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

    const descriptors = compileToDescriptors(schemas)

    if (descriptors[0].type === "field") {
      expect(descriptors[0].schema.required).toBe(true)
      expect(descriptors[0].validation.rules).toEqual("required")
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

    const descriptors = compileToDescriptors(schemas)

    if (descriptors[0].type === "field") {
      expect(descriptors[0].schema.visible).toBe(false)
      expect(descriptors[0].schema.readonly).toBe(true)
      expect(descriptors[0].schema.disabled).toBe(true)
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
        contentAlign: "right",
        colon: false,
      },
    ]

    const descriptors = compileToDescriptors(schemas)

    if (descriptors[0].type === "field") {
      expect(descriptors[0].schema.componentType).toBe("input")
      expect(descriptors[0].schema.labelIcon).toBe("user")
      expect(descriptors[0].schema.labelAlign).toBe("left")
      expect(descriptors[0].schema.labelPosition).toBe("top")
      expect(descriptors[0].schema.labelWidth).toBe("96px")
      expect(descriptors[0].schema.contentAlign).toBe("right")
      expect(descriptors[0].schema.colon).toBe(false)
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

    const descriptors = compileToDescriptors(schemas)

    if (descriptors[0].type === "field") {
      expect(descriptors[0].schema.tooltip).toBe("公开显示的昵称")
      expect(descriptors[0].schema.layout).toEqual({ span: 12 })
      expect(Object.isFrozen(descriptors[0].schema.layout)).toBe(false)
    }
  })

  it("不应该在分组 descriptor 中保留扩展 meta", () => {
    const schemas: SchemxField[] = [
      {
        label: "基本信息",
        componentType: "group",
        children: [],
        tooltip: "基础资料",
        style: { marginTop: 8 },
      } as any,
    ]

    const descriptors = compileToDescriptors(schemas)

    if (descriptors[0].type === "group") {
      expect("meta" in descriptors[0]).toBe(false)
    }
  })

  it("应该生成稳定 key", () => {
    const schemas: SchemxField[] = [
      { name: "a", label: "A", componentType: "input" },
      { name: "b", label: "B", componentType: "input" },
    ]

    const run1 = compileToDescriptors(schemas)
    const run2 = compileToDescriptors(schemas)

    expect(run1[0].key).toBe(run2[0].key)
    expect(run1[1].key).toBe(run2[1].key)
  })

  it("key 不会因 schema 插入/删除而改变", () => {
    const before = compileToDescriptors([
      { name: "a", label: "A", componentType: "input" },
      { name: "c", label: "C", componentType: "input" },
    ])

    const after = compileToDescriptors([
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
        componentType: "group",
        children: [
          {
            label: "内层",
            componentType: "group",
            children: [
              { name: "deep", label: "Deep", componentType: "input" },
            ],
          },
        ],
      },
    ]

    const descriptors = compileToDescriptors(schemas)

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
        componentType: "group",
        children: [
          { name: "email", label: "邮箱", componentType: "input" },
        ],
      },
    ]

    const descriptors = compileToDescriptors(schemas)

    expect(descriptors).toHaveLength(2)
    expect(descriptors[0].type).toBe("field")
    expect(descriptors[1].type).toBe("group")
  })

  it("应该在 name 为空时过滤该字段", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const schemas: SchemxField[] = [
      { name: "" as any, label: "Bad", componentType: "input" },
    ]

    expect(compileToDescriptors(schemas)).toEqual([])
    warnSpy.mockRestore()
  })

  it("应该在 dependency 无 trigger 时抛出 CompileError", () => {
    const schemas: SchemxField[] = [
      {
        componentType: "dependency",
        to: [],
        renderer: () => [],
      },
    ]

    expect(() => compileToDescriptors(schemas)).toThrow(CompileError)
  })

  it("应该使用全局 readonly/disabled 默认值", () => {
    const schemas: SchemxField[] = [
      { name: "f1", label: "F1", componentType: "input" },
    ]

    const descriptors = compileToDescriptors(schemas, {
      readonly: true,
      disabled: true,
    })

    if (descriptors[0].type === "field") {
      expect(descriptors[0].schema.readonly).toBe(true)
      expect(descriptors[0].schema.disabled).toBe(true)
    }
  })

  it("应该保留已有的 key", () => {
    const schemas: SchemxField[] = [
      { key: "my-custom-key", name: "f1", label: "F1", componentType: "input" },
    ]

    const descriptors = compileToDescriptors(schemas)
    expect(descriptors[0].key).toBe("my-custom-key")
  })
})
