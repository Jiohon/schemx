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

import { resolveTaskScript, selectTargets } from "./lib/targets.mjs"
import { createTerminalSession } from "./lib/terminal-feedback/index.mjs"

const SCOPES = ["packages", "plugins", "examples"]

const [task, ...rest] = process.argv.slice(2)
const session = createTerminalSession()

if (!task) {
  session.notice({ level: "error", message: "用法：node run-with-targets.mjs <task>" })
  session.notice({
    level: "info",
    message: "task: 要在目标中执行的脚本名（如 lint/build/test/dev）",
  })
  process.exit(1)
}

if (rest.length > 0) {
  session.notice({
    level: "warning",
    message: `已忽略额外参数 ${rest.join(" ")}。目标通过交互选择。`,
  })
}

session.begin({ title: `Schemx ${task}` })

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
  session.notice({ level: "warning", message: `没有目标定义了 ${task} 脚本，无需执行。` })
  session.finish({ message: "无需执行" })
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

const selectionMode = source === "prompt" ? "交互选择" : "非交互默认全部"
session.section({
  title: TASK_LABELS[task] ?? `执行 ${task}`,
  details: {
    模式: selectionMode,
    目标: targets.map((target) => target.name),
  },
})

// 串行执行，避免多个 dev 服务或构建日志相互干扰。
let hasCompletedTarget = false

for (const target of targets) {
  const targetScript = resolveTaskScript(target.scripts, task)

  if (!targetScript) {
    session.notice({
      level: "error",
      message: `${target.name} 没有可执行的 ${task} 脚本。`,
    })
    process.exit(1)
  }

  const label = `${TASK_LABELS[task] ?? `执行 ${task}`} ${target.name}`
  if (hasCompletedTarget) session.gap()

  const result = await session.run({
    command: "pnpm",
    args: ["--filter", target.name, "run", targetScript],
    label,
  })

  if (result.code !== 0) {
    process.exitCode = result.code
    break
  }

  hasCompletedTarget = true
}

if (hasCompletedTarget) session.gap()

session.finish({
  status: process.exitCode ? "error" : "success",
  message: process.exitCode ? "执行失败" : "全部完成",
})
