#!/usr/bin/env node

import { cancel as cancelPrompt, isCancel, select } from "@clack/prompts"

const args = process.argv.slice(2)
const kindOptionIndex = args.indexOf("--kind")
const kind =
  kindOptionIndex === -1 ? "target" : args.splice(kindOptionIndex, 2)[1] || "target"
const channelOptionIndex = args.indexOf("--channel")
const channel =
  channelOptionIndex === -1 ? "latest" : args.splice(channelOptionIndex, 2)[1] || "latest"
const targetOptionIndex = args.indexOf("--target")
const target = targetOptionIndex === -1 ? "" : args.splice(targetOptionIndex, 2)[1] || ""
const options = args

const channelLabels = {
  dev: "Dev 开发测试发布，用于日常开发测试，不保证稳定。",
  alpha: "Alpha 预发布，用于早期实验和开发分支临时验证。",
  beta: "Beta 预发布，用于公开测试。",
  rc: "RC 候选发布，用于正式版前的候选验证。",
  next: "Next 预发布，用于下一版本预览。",
  latest: "正式版发布，仅允许 main 分支。",
}

const versionLabels = {
  current: "使用当前版本",
  patch: "提升 patch 版本（x.y.z 的 z 位）",
  minor: "提升 minor 版本（x.y.z 的 y 位）",
  major: "提升 major 版本（x.y.z 的 x 位）",
  custom: "指定版本",
}

const kindConfig = {
  channel: {
    env: "SCHEMX_RELEASE_CHANNEL",
    title: "请选择发布通道",
    unknown: "未知发布模式",
    labels: channelLabels,
  },
  target: {
    env: "SCHEMX_RELEASE_TARGET",
    title: "请选择发布目标",
    unknown: "未知发布目标",
  },
  "version-action": {
    env: "SCHEMX_RELEASE_VERSION_ACTION",
    title: "请选择正式版本处理方式",
    unknown: "未知版本处理方式",
    labels: versionLabels,
  },
}

// 所有参数与交互错误统一写入 stderr 并使用失败退出码。
function fail(message) {
  process.stderr.write(` 错误：${message}\n`)
  process.exit(1)
}

// 取消不是发布失败；使用固定标记通知 Shell 调用方停止后续流程。
function cancel() {
  // pnpm 会把非 0 退出码包装成 ELIFECYCLE；取消选择应停止发布但不算脚本失败。
  cancelPrompt("已取消选择", { output: process.stderr })
  process.stdout.write("__SCHEMX_RELEASE_CANCELLED__\n")
  process.exit(0)
}

// 环境变量提供的自动化选择也必须受当前选项集约束。
function validateOption(option) {
  if (!options.includes(option)) {
    fail(`${config.unknown}：${option}，可选值为 ${options.join("、")}`)
  }
}

const config = kindConfig[kind]
if (!config) {
  fail(`未知选择类型：${kind}，可选值为 ${Object.keys(kindConfig).join("、")}`)
}

if (options.length === 0) {
  fail("缺少选项列表")
}

if (!channelLabels[channel]) {
  fail(`未知发布模式：${channel}，可选值为 ${Object.keys(channelLabels).join("、")}`)
}

const envOption = process.env[config.env]
if (envOption) {
  // 自动化场景不应依赖 TTY 交互，CI/测试可通过环境变量指定选择项。
  validateOption(envOption)
  process.stdout.write(`${envOption}\n`)
  process.exit(0)
}

if (!process.stdin.isTTY || !process.stderr.isTTY) {
  fail(`当前终端不支持交互选择。请传入参数，或设置 ${config.env}。`)
}

// 在交互列表中补充通道或版本动作的解释。
function optionLabel(option) {
  return config.labels?.[option] ? `${option} - ${config.labels[option]}` : option
}

// 后续选择展示已选通道和目标，避免多步交互失去上下文。
function selectedContext() {
  if (kind === "channel") {
    return ""
  }

  const lines = [`发布通道：${channel} - ${channelLabels[channel]}`]

  if (target) {
    lines.push(`发布目标：${target}`)
  }

  return `\n${lines.join("\n")}`
}

const selected = await select({
  message: `${config.title}${selectedContext()}`,
  options: options.map((option) => ({
    value: option,
    label: optionLabel(option),
  })),
  initialValue: options[0],
  output: process.stderr,
})

if (isCancel(selected)) {
  cancel()
}

process.stdout.write(`${selected}\n`)
