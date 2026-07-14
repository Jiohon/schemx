import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { printSection } from "../lib/terminal.mjs"

const rootDir = resolve(import.meta.dirname, "../..")

// 读取仓库相对路径的 JSON 配置。
function readJson(path) {
  return JSON.parse(readFileSync(resolve(rootDir, path), "utf8"))
}

// 将缺失的受检文件记录为配置错误，其余读取错误仍应直接抛出。
function readText(path) {
  try {
    return readFileSync(resolve(rootDir, path), "utf8")
  } catch (error) {
    if (error?.code === "ENOENT") {
      failures.push(`${path}: 文件不存在`)
      return ""
    }

    throw error
  }
}

const packagePeerRules = [
  {
    file: "packages/vue/package.json",
    peers: ["@schemx/core"],
  },
  {
    file: "packages/vant/package.json",
    peers: ["@schemx/core", "@schemx/vue"],
  },
]

const vitePackageFiles = [
  "packages/core/package.json",
  "packages/vue/package.json",
  "packages/vant/package.json",
]

const envRules = [
  {
    file: "packages/core/.env",
    required: ["VITE_ANALYZE="],
  },
  {
    file: "packages/vue/.env",
    required: ["VITE_USE_SOURCE=", "VITE_ANALYZE="],
  },
  {
    file: "packages/vant/.env",
    required: ["VITE_USE_SOURCE=", "VITE_ANALYZE="],
  },
]

const standaloneForbiddenRules = [
  {
    file: "packages/vant/package.json",
    forbidden: ["standalone", "normalize-vant-dts", "--mode standalone"],
  },
  {
    file: "packages/vant/.env",
    forbidden: ["VITE_BUILD_STANDALONE"],
  },
  {
    file: ".gitignore",
    forbidden: ["packages/vant/.env.standalone"],
  },
]

// 聚合所有约束违规项，避免修复一次后才看到下一项。
const failures = []

printSection("检查包配置")

// 内部包既要声明 peerDependency，也要保留本地开发依赖。
for (const rule of packagePeerRules) {
  const packageJson = readJson(rule.file)

  for (const peerName of rule.peers) {
    if (!packageJson.peerDependencies?.[peerName]) {
      failures.push(`${rule.file}: peerDependencies 缺少 ${peerName}`)
    }

    if (packageJson.dependencies?.[peerName]) {
      failures.push(`${rule.file}: dependencies 不应声明 ${peerName}`)
    }

    if (!packageJson.devDependencies?.[peerName]) {
      failures.push(`${rule.file}: devDependencies 缺少本地开发依赖 ${peerName}`)
    }
  }
}

// VITE_* 开关必须集中在 .env，防止 npm scripts 产生隐式构建分支。
for (const file of vitePackageFiles) {
  const packageJson = readJson(file)
  for (const [scriptName, script] of Object.entries(packageJson.scripts ?? {})) {
    if (/\bVITE_[A-Z0-9_]+=/.test(script)) {
      failures.push(`${file}: scripts.${scriptName} 不应内联 VITE_* 环境变量`)
    }
  }
}

// 确认各包的环境开关具备统一的默认定义。
for (const rule of envRules) {
  const source = readText(rule.file)
  for (const required of rule.required) {
    if (!source.includes(required)) {
      failures.push(`${rule.file}: 缺少 ${required}`)
    }
  }
}

// 已废弃的 standalone 构建分支不得重新进入配置。
for (const rule of standaloneForbiddenRules) {
  const source = readText(rule.file)
  for (const forbidden of rule.forbidden) {
    if (source.includes(forbidden)) {
      failures.push(`${rule.file}: 不应包含 standalone 逻辑 ${forbidden}`)
    }
  }
}

if (failures.length > 0) {
  console.error("包配置检查失败：")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log("包配置检查通过。")
