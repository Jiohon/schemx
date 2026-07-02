import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const checks = [
  {
    file: "packages/core/dist/index.mjs",
    forbidden: ["simple-async-context", "es-toolkit", "es-toolkit/compat", "@preact/signals-core"],
  },
  {
    file: "packages/core/dist/index.cjs",
    forbidden: ["simple-async-context", "es-toolkit", "es-toolkit/compat", "@preact/signals-core"],
  },
  {
    file: "packages/vue/dist/index.mjs",
    forbidden: [
      "@schemx/core",
      "simple-async-context",
      "es-toolkit",
      "es-toolkit/compat",
      "@preact/signals-core",
      "classnames",
      "dayjs",
    ],
  },
  {
    file: "packages/vue/dist/index.cjs",
    forbidden: [
      "@schemx/core",
      "simple-async-context",
      "es-toolkit",
      "es-toolkit/compat",
      "@preact/signals-core",
      "classnames",
      "dayjs",
    ],
  },
  {
    file: "packages/vant/dist/index.mjs",
    forbidden: [
      "@schemx/core",
      "@schemx/vue",
      "simple-async-context",
      "es-toolkit",
      "es-toolkit/compat",
      "@preact/signals-core",
      "classnames",
      "dayjs",
    ],
  },
  {
    file: "packages/vant/dist/index.cjs",
    forbidden: [
      "@schemx/core",
      "@schemx/vue",
      "simple-async-context",
      "es-toolkit",
      "es-toolkit/compat",
      "@preact/signals-core",
      "classnames",
      "dayjs",
    ],
  },
]

function hasBareSpecifier(source, specifier) {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const patterns = [
    new RegExp(`\\bfrom\\s*["']${escaped}["']`),
    new RegExp(`\\bimport\\s*\\(\\s*["']${escaped}["']\\s*\\)`),
    new RegExp(`\\brequire\\s*\\(\\s*["']${escaped}["']\\s*\\)`),
  ]

  return patterns.some((pattern) => pattern.test(source))
}

const failures = []

for (const check of checks) {
  const filePath = resolve(rootDir, check.file)
  const source = readFileSync(filePath, "utf8")
  const leaked = check.forbidden.filter((specifier) => hasBareSpecifier(source, specifier))

  if (leaked.length > 0) {
    failures.push(`${check.file}: ${leaked.join(", ")}`)
  }
}

if (failures.length > 0) {
  console.error("包产物仍暴露内部依赖解析边界：")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log("包产物边界检查通过。")
