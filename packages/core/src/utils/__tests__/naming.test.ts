/**
 * naming 命名格式工具单元测试
 *
 * 覆盖格式检测（isCamelCase、isKebabCase、isLowerCase）、
 * 双向转换（camelToKebab、kebabToCamel）和归一化（normalizeToKebab、normalizeToCamel）。
 *
 * @module utils/__tests__/naming
 */
import { describe, expect, it } from "vitest"

import {
  camelToKebab,
  isCamelCase,
  isKebabCase,
  isLowerCase,
  kebabToCamel,
  normalizeToCamel,
  normalizeToKebab,
} from "../naming"

describe("isCamelCase", () => {
  it("包含大写字母返回 true", () => {
    expect(isCamelCase("myComponent")).toBe(true)
    expect(isCamelCase("backgroundColor")).toBe(true)
  })

  it("全小写或含连字符返回 false", () => {
    expect(isCamelCase("text")).toBe(false)
    expect(isCamelCase("my-component")).toBe(false)
  })
})

describe("isKebabCase", () => {
  it("包含连字符返回 true", () => {
    expect(isKebabCase("my-component")).toBe(true)
    expect(isKebabCase("font-size")).toBe(true)
  })

  it("不含连字符返回 false", () => {
    expect(isKebabCase("myComponent")).toBe(false)
    expect(isKebabCase("text")).toBe(false)
  })
})

describe("isLowerCase", () => {
  it("全小写且不含连字符返回 true", () => {
    expect(isLowerCase("text")).toBe(true)
    expect(isLowerCase("number")).toBe(true)
  })

  it("含大写字母或连字符返回 false", () => {
    expect(isLowerCase("myComponent")).toBe(false)
    expect(isLowerCase("my-component")).toBe(false)
  })
})

describe("camelToKebab", () => {
  it("驼峰格式正确转换为 kebab-case", () => {
    expect(camelToKebab("myComponent")).toBe("my-component")
    expect(camelToKebab("backgroundColor")).toBe("background-color")
  })

  it("纯小写字符串保持不变", () => {
    expect(camelToKebab("text")).toBe("text")
  })
})

describe("kebabToCamel", () => {
  it("kebab-case 正确转换为 camelCase", () => {
    expect(kebabToCamel("my-component")).toBe("myComponent")
    expect(kebabToCamel("background-color")).toBe("backgroundColor")
  })

  it("纯小写字符串保持不变", () => {
    expect(kebabToCamel("text")).toBe("text")
  })
})

describe("normalizeToKebab", () => {
  it("驼峰格式归一化为 kebab-case", () => {
    expect(normalizeToKebab("myComponent")).toBe("my-component")
  })

  it("已是 kebab-case 保持不变", () => {
    expect(normalizeToKebab("my-component")).toBe("my-component")
  })

  it("纯小写保持不变", () => {
    expect(normalizeToKebab("text")).toBe("text")
  })
})

describe("normalizeToCamel", () => {
  it("kebab-case 归一化为 camelCase", () => {
    expect(normalizeToCamel("my-component")).toBe("myComponent")
  })

  it("已是驼峰格式保持不变", () => {
    expect(normalizeToCamel("myComponent")).toBe("myComponent")
  })

  it("纯小写保持不变", () => {
    expect(normalizeToCamel("text")).toBe("text")
  })
})

import fc from "fast-check"

describe("naming 属性测试", () => {
  it("camelCase 往返一致性: kebabToCamel(camelToKebab(str)) 等价于原始字符串", () => {
    /**
     * 生成有效的 camelCase 字符串：以小写字母开头，
     * 后跟若干 [小写段 + 大写字母] 的组合。
     */
    const camelCaseArb = fc
      .tuple(
        fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")), {
          minLength: 1,
          maxLength: 5,
        }),
        fc.array(
          fc.tuple(
            fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")),
            fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")), {
              minLength: 1,
              maxLength: 5,
            })
          ),
          { minLength: 1, maxLength: 4 }
        )
      )
      .map(([head, parts]) => head + parts.map(([upper, tail]) => upper + tail).join(""))

    fc.assert(
      fc.property(camelCaseArb, (str) => {
        expect(kebabToCamel(camelToKebab(str))).toBe(str)
      }),
      { numRuns: 200 }
    )
  })
})
