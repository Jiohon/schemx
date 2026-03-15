/**
 * 属性测试 - 项目重命名正确性验证
 *
 * 使用 fast-check 验证三个正确性属性：
 * 1. 旧命名模式完全消除
 * 2. CSS 旧前缀完全消除
 * 3. 核心类名与 Hooks 函数名保持不变
 *
 * @module core/__tests__/rename-properties
 */

import * as fs from "node:fs"
import * as path from "node:path"

import * as fc from "fast-check"
import { describe, it } from "vitest"

const ROOT = path.resolve(__dirname, "../../../../..")

/**
 * 递归收集指定扩展名的文件路径
 *
 * @param dir - 起始目录
 * @param extensions - 允许的扩展名集合
 * @param result - 累积结果数组
 *
 * @returns 匹配的文件路径数组
 */
function collectFiles(
  dir: string,
  extensions: Set<string>,
  result: string[] = []
): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (["node_modules", ".git", "dist", ".pnpm-store", ".kiro"].includes(entry.name))
        continue
      collectFiles(full, extensions, result)
    } else if (extensions.has(path.extname(entry.name))) {
      result.push(full)
    }
  }

  return result
}

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".vue", ".json", ".md", ".html"])
const CSS_EXTENSIONS = new Set([".css", ".scss"])
const ALL_EXTENSIONS = new Set([...SOURCE_EXTENSIONS, ...CSS_EXTENSIONS])

const allFiles = collectFiles(ROOT, ALL_EXTENSIONS).filter(
  (f) => !f.includes("pnpm-lock.yaml") && !f.includes("rename-properties.test.ts")
)
const sourceFiles = allFiles.filter((f) => SOURCE_EXTENSIONS.has(path.extname(f)))
const cssFiles = allFiles.filter((f) => CSS_EXTENSIONS.has(path.extname(f)))

/** 旧命名模式正则 */
const OLD_NAMING_PATTERNS = [
  /SchemaForm(?!Store)/g, // SchemaForm（排除 FormStore 误匹配）
  /@jonhn\/schema-form/g, // 旧包名
  /vue-schema-form/g, // 旧项目名
]

/** 旧 CSS 前缀正则 */
const OLD_CSS_PATTERNS = [
  /\.schema-form-/g, // CSS 类名
  /--schema-form-/g, // CSS 变量
]

/** 核心类名和 hooks 函数名（必须保持不变） */
const CORE_IDENTIFIERS: Array<{ name: string; file: string }> = [
  { name: "FormStore", file: "packages/core/src/core/store.ts" },
  { name: "Subscriber", file: "packages/core/src/core/subscriber.ts" },
  { name: "Validator", file: "packages/core/src/core/validator.ts" },
  { name: "RendererRegistry", file: "packages/core/src/core/rendererRegistry.ts" },
  { name: "RulesRegistry", file: "packages/core/src/core/rulesRegistry.ts" },
  { name: "useForm", file: "packages/core/src/hooks/useForm/createForm.ts" },
  { name: "useField", file: "packages/core/src/hooks/useField/index.ts" },
  { name: "useDictOptions", file: "packages/core/src/hooks/useDictOptions/index.ts" },
  { name: "useDependency", file: "packages/core/src/hooks/useDependency/index.ts" },
  { name: "useFormContext", file: "packages/core/src/hooks/useFormContext/index.ts" },
  { name: "useRequester", file: "packages/core/src/hooks/useRequester/index.ts" },
  { name: "useWatch", file: "packages/core/src/hooks/useWatch/index.ts" },
]

describe("Property 1: 旧命名模式完全消除", () => {
  it("随机源文件不包含任何旧命名模式", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: sourceFiles.length - 1 }), (idx) => {
        const filePath = sourceFiles[idx]
        const content = fs.readFileSync(filePath, "utf-8")
        for (const pattern of OLD_NAMING_PATTERNS) {
          pattern.lastIndex = 0
          const match = pattern.exec(content)
          if (match) {
            throw new Error(
              `文件 ${path.relative(ROOT, filePath)} 包含旧命名 "${match[0]}" (位置 ${match.index})`
            )
          }
        }

        return true
      }),
      { numRuns: Math.min(sourceFiles.length, 200) }
    )
  })
})

describe("Property 2: CSS 旧前缀完全消除", () => {
  it("随机 CSS/SCSS/TSX 文件不包含旧 CSS 前缀", () => {
    const cssAndTsxFiles = allFiles.filter((f) => {
      const ext = path.extname(f)

      return ext === ".css" || ext === ".scss" || ext === ".tsx"
    })

    fc.assert(
      fc.property(fc.integer({ min: 0, max: cssAndTsxFiles.length - 1 }), (idx) => {
        const filePath = cssAndTsxFiles[idx]
        const content = fs.readFileSync(filePath, "utf-8")
        for (const pattern of OLD_CSS_PATTERNS) {
          pattern.lastIndex = 0
          const match = pattern.exec(content)
          if (match) {
            throw new Error(
              `文件 ${path.relative(ROOT, filePath)} 包含旧 CSS 前缀 "${match[0]}" (位置 ${match.index})`
            )
          }
        }

        return true
      }),
      { numRuns: Math.min(cssAndTsxFiles.length, 200) }
    )
  })
})

describe("Property 3: 核心类名与 Hooks 函数名保持不变", () => {
  it("随机核心标识符在其定义文件中仍然存在", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: CORE_IDENTIFIERS.length - 1 }), (idx) => {
        const { name, file } = CORE_IDENTIFIERS[idx]
        const fullPath = path.join(ROOT, file)
        const content = fs.readFileSync(fullPath, "utf-8")
        if (!content.includes(name)) {
          throw new Error(`核心标识符 "${name}" 在 ${file} 中未找到`)
        }

        return true
      }),
      { numRuns: CORE_IDENTIFIERS.length * 10 }
    )
  })
})
