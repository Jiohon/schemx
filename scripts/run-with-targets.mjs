#!/usr/bin/env node
/**
 * 目标运行器：在选定的 packages / plugins / examples 目标中执行某个脚本。
 *
 * 用法：node run-with-targets.mjs <task>
 *   task: 要在目标中执行的脚本名（如 lint / build / test / dev）
 *
 * 目标选择统一交给 select-targets.mjs：
 *   - TTY -> @clack/prompts groupMultiselect 按 scope 分组交互选择；
 *   - 非 TTY -> 默认全部（CI / 自动化）。
 *
 * 目标名不通过命令行参数传入（统一走交互选择）。额外位置参数会被忽略并提示。
 */

import { spawnSync } from "node:child_process"

import { printSection } from "./lib/terminal.mjs"
import { resolveTaskScript, selectTargets } from "./lib/targets.mjs"

const SCOPES = ["packages", "plugins", "examples"]

const [task, ...rest] = process.argv.slice(2)

if (!task) {
  process.stderr.write("用法：node run-with-targets.mjs <task>\n")
  process.stderr.write("  task: 要在目标中执行的脚本名（如 lint/build/test/dev）\n")
  process.exit(1)
}

if (rest.length > 0) {
  process.stderr.write(`提示：已忽略额外参数 ${rest.join(" ")}。目标通过交互选择。\n`)
}

// 选择逻辑在 TTY 与 CI 间保持一致：交互选择或自动选择全部匹配目标。
const result = await selectTargets(SCOPES, {
  task,
  title: `请选择 ${task} 的目标`,
})

if (!result) {
  // 用户取消：退出 0，不执行任何命令。
  process.exit(0)
}

const { targets, source } = result

if (targets.length === 0) {
  process.stderr.write(`没有目标定义了 ${task} 脚本，无需执行。\n`)
  process.exit(0)
}

const TASK_LABELS = {
  build: "构建",
  "build:analyze": "构建分析",
  check: "检查",
  dev: "启动开发服务",
  format: "格式化",
  "format:check": "检查格式",
  lint: "检查 lint",
  "lint:fix": "修复 lint",
  test: "测试",
  "type-check": "类型检查",
}

const label = source === "prompt" ? "交互选择" : "非交互默认全部"
process.stderr.write(`[${label}] 共执行 ${targets.length} 个目标。\n`)

// 串行执行，避免多个 dev 服务或构建日志相互干扰。
for (const target of targets) {
  const targetScript = resolveTaskScript(target.scripts, task)

  if (!targetScript) {
    process.stderr.write(`${target.name} 没有可执行的 ${task} 脚本。\n`)
    process.exit(1)
  }

  printSection(`${TASK_LABELS[task] ?? `执行 ${task}`} ${target.name}`)

  // 白名单任务可能映射到 dev:h5 / build:h5；其余任务仍执行同名 script。
  const child = spawnSync("pnpm", ["--filter", target.name, "run", targetScript], {
    stdio: "inherit",
    shell: process.platform === "win32",
  })

  if (child.error) {
    process.stderr.write(`pnpm 启动失败：${child.error.message}\n`)
    process.exit(1)
  }

  if (child.status !== 0) {
    process.exit(child.status ?? 1)
  }
}
