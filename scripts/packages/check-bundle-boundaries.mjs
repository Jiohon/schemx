import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { createTerminalSession } from "../lib/terminal-feedback/index.mjs"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

const checks = [
  {
    file: "packages/validator/dist/index.mjs",
    forbidden: ["@schemx/core", "zod", "async-validator"],
  },
  {
    file: "packages/validator/dist/index.cjs",
    forbidden: ["@schemx/core", "zod", "async-validator"],
  },
  {
    file: "packages/validator/dist/zod.mjs",
    // zod adapter 是结构性类型，运行时不 import zod（用户自行 import 造 schema）。
    forbidden: ["async-validator"],
  },
  {
    file: "packages/validator/dist/zod.cjs",
    // zod adapter 是结构性类型，运行时不 import zod（用户自行 import 造 schema）。
    forbidden: ["async-validator"],
  },
  {
    file: "packages/validator/dist/async-validator.mjs",
    requiredWhenImplemented: ["async-validator"],
    forbidden: ["zod"],
  },
  {
    file: "packages/validator/dist/async-validator.cjs",
    requiredWhenImplemented: ["async-validator"],
    forbidden: ["zod"],
  },
  {
    file: "packages/validator/dist/preset.mjs",
    // 预设尚未实现；其 peer 边界应随最终组合策略一同定义。
    forbidden: [],
  },
  {
    file: "packages/validator/dist/preset.cjs",
    forbidden: [],
  },
  {
    file: "packages/core/dist/index.mjs",
    required: ["es-toolkit", "es-toolkit/compat", "@preact/signals-core"],
  },
  {
    file: "packages/core/dist/index.cjs",
    required: ["es-toolkit", "es-toolkit/compat", "@preact/signals-core"],
  },
  {
    file: "packages/vue/dist/index.mjs",
    required: ["@schemx/core", "classnames", "es-toolkit"],
    forbidden: ["simple-async-context", "@preact/signals-core"],
  },
  {
    file: "packages/vue/dist/index.cjs",
    required: ["@schemx/core", "classnames", "es-toolkit"],
    forbidden: ["simple-async-context", "@preact/signals-core"],
  },
  {
    file: "packages/vant/dist/index.mjs",
    required: ["@schemx/vue", "classnames", "dayjs", "es-toolkit"],
    forbidden: ["simple-async-context", "@preact/signals-core"],
  },
  {
    file: "packages/vant/dist/index.cjs",
    required: ["@schemx/vue", "classnames", "dayjs", "es-toolkit"],
    forbidden: ["simple-async-context", "@preact/signals-core"],
  },
]

const declarationChecks = [
  {
    file: "packages/validator/dist/zod.d.ts",
    implementationFile: "packages/validator/dist/zod.mjs",
    requiredWhenImplemented: ["@schemx/core"],
    forbidden: ["../../core/src", "../../core/dist"],
  },
  {
    file: "packages/validator/dist/async-validator.d.ts",
    implementationFile: "packages/validator/dist/async-validator.mjs",
    requiredWhenImplemented: ["@schemx/core"],
    forbidden: ["../../core/src", "../../core/dist"],
  },
  {
    file: "packages/validator/dist/preset.d.ts",
    forbidden: ["../../core/src", "../../core/dist"],
  },
  {
    file: "packages/vant/dist/index.d.ts",
    forbidden: ["../../vue/src", "../../core/src"],
    required: ["@schemx/vue", "@schemx/core"],
  },
]

// 同时识别静态 import、动态 import 与 CommonJS require，避免产物把依赖打进包内。
function hasBareSpecifier(source, specifier, { allowSubpath = false } = {}) {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const suffix = allowSubpath ? `(?:/[^"']*)?` : ""
  const patterns = [
    new RegExp(`\\bfrom\\s*["']${escaped}${suffix}["']`),
    new RegExp(`\\bimport\\s*\\(\\s*["']${escaped}${suffix}["']\\s*\\)`),
    new RegExp(`\\brequire\\s*\\(\\s*["']${escaped}${suffix}["']\\s*\\)`),
  ]

  return patterns.some((pattern) => pattern.test(source))
}

// 占位入口只调用受控的 unavailable helper，加载时不得解析 optional peer。
// adapter 实现替换该调用后，才要求对应 optional peer 的 Vite external import 必须保留。
function isUnavailablePlaceholder(source) {
  return source.includes("validatorAdapterUnavailable(")
}

// 先收集全部违规项，再一次性报告，方便修复多个包边界问题。
const failures = []
const session = createTerminalSession()

session.begin({ title: "Schemx" })
session.section({ title: "检查包产物边界" })

// 检查 JavaScript 产物是否保留预期的 external import。
for (const check of checks) {
  const filePath = resolve(rootDir, check.file)
  const source = readFileSync(filePath, "utf8")
  const required = [
    ...(check.required ?? []),
    ...(isUnavailablePlaceholder(source) ? [] : (check.requiredWhenImplemented ?? [])),
  ]
  const missing = required.filter(
    (specifier) => !hasBareSpecifier(source, specifier)
  )
  const leaked = (check.forbidden ?? []).filter((specifier) =>
    hasBareSpecifier(source, specifier, { allowSubpath: true })
  )

  if (missing.length > 0) {
    failures.push(`${check.file}: 缺少 ${missing.join(", ")}`)
  }

  if (leaked.length > 0) {
    failures.push(`${check.file}: 泄漏 ${leaked.join(", ")}`)
  }
}

// 声明文件不能回指 workspace 源码路径。
for (const check of declarationChecks) {
  const filePath = resolve(rootDir, check.file)
  const source = readFileSync(filePath, "utf8")
  const implementationSource = check.implementationFile
    ? readFileSync(resolve(rootDir, check.implementationFile), "utf8")
    : null
  const required = [
    ...(check.required ?? []),
    ...(implementationSource && !isUnavailablePlaceholder(implementationSource)
      ? (check.requiredWhenImplemented ?? [])
      : []),
  ]
  const missing = required.filter(
    (specifier) => !source.includes(specifier)
  )
  const leaked = check.forbidden.filter((specifier) => source.includes(specifier))

  if (missing.length > 0) {
    failures.push(`${check.file}: 类型声明缺少 ${missing.join(", ")}`)
  }

  if (leaked.length > 0) {
    failures.push(`${check.file}: 类型声明泄漏 ${leaked.join(", ")}`)
  }
}

if (failures.length > 0) {
  session.notice({ level: "error", message: "包产物未保留依赖式 external 边界：" })
  for (const failure of failures) {
    session.notice({ level: "error", message: `  ${failure}` })
  }

  process.exit(1)
}

session.notice({ level: "success", message: "包产物边界检查通过" })
session.finish()
