import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const checks = [
  {
    file: "packages/core/dist/index.mjs",
    required: [
      "simple-async-context",
      "es-toolkit",
      "es-toolkit/compat",
      "@preact/signals-core",
    ],
  },
  {
    file: "packages/core/dist/index.cjs",
    required: [
      "simple-async-context",
      "es-toolkit",
      "es-toolkit/compat",
      "@preact/signals-core",
    ],
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
    required: ["@schemx/core", "@schemx/vue", "classnames", "dayjs", "es-toolkit"],
    forbidden: ["simple-async-context", "@preact/signals-core"],
  },
  {
    file: "packages/vant/dist/index.cjs",
    required: ["@schemx/core", "@schemx/vue", "classnames", "dayjs", "es-toolkit"],
    forbidden: ["simple-async-context", "@preact/signals-core"],
  },
  {
    file: "packages/vant/dist/standalone.mjs",
    required: ["vue", "vant"],
    forbidden: [
      "@schemx/core",
      "@schemx/vue",
      "@preact/signals-core",
      "simple-async-context",
      "tslib",
      "classnames",
      "dayjs",
      "es-toolkit",
    ],
  },
  {
    file: "packages/vant/dist/standalone.cjs",
    required: ["vue", "vant"],
    forbidden: [
      "@schemx/core",
      "@schemx/vue",
      "@preact/signals-core",
      "simple-async-context",
      "tslib",
      "classnames",
      "dayjs",
      "es-toolkit",
    ],
  },
]

const declarationChecks = [
  {
    file: "packages/vant/dist/index.d.ts",
    forbidden: ["../../vue/src", "../../core/src"],
    required: ["@schemx/vue", "@schemx/core"],
  },
  {
    file: "packages/vant/dist/standalone.d.ts",
    forbidden: ["../../vue/src", "../../core/src"],
    required: ["@schemx/vue", "@schemx/core"],
  },
]

const packageChecks = [
  {
    file: "packages/vant/package.json",
    validate(packageJson) {
      const standaloneTypes =
        packageJson.typesVersions?.["*"]?.standalone ?? []

      if (!standaloneTypes.includes("./dist/standalone.d.ts")) {
        return [
          "packages/vant/package.json: typesVersions 缺少 standalone 类型映射",
        ]
      }

      return []
    },
  },
]

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

const failures = []

for (const check of checks) {
  const filePath = resolve(rootDir, check.file)
  const source = readFileSync(filePath, "utf8")
  const missing = check.required.filter(
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

for (const check of declarationChecks) {
  const filePath = resolve(rootDir, check.file)
  const source = readFileSync(filePath, "utf8")
  const missing = check.required.filter((specifier) => !source.includes(specifier))
  const leaked = check.forbidden.filter((specifier) => source.includes(specifier))

  if (missing.length > 0) {
    failures.push(`${check.file}: 类型声明缺少 ${missing.join(", ")}`)
  }

  if (leaked.length > 0) {
    failures.push(`${check.file}: 类型声明泄漏 ${leaked.join(", ")}`)
  }
}

for (const check of packageChecks) {
  const filePath = resolve(rootDir, check.file)
  const packageJson = JSON.parse(readFileSync(filePath, "utf8"))
  failures.push(...check.validate(packageJson))
}

if (failures.length > 0) {
  console.error("包产物未保留依赖式 external 边界：")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log("包产物边界检查通过。")
