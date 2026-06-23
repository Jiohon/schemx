#!/usr/bin/env node

import readline from "node:readline"

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

function fail(message) {
  process.stderr.write(` 错误：${message}\n`)
  process.exit(1)
}

function cancel() {
  // pnpm 会把非 0 退出码包装成 ELIFECYCLE；取消选择应停止发布但不算脚本失败。
  process.stderr.write("\n  已取消选择\n")
  process.stdout.write("__SCHEMX_RELEASE_CANCELLED__\n")
  process.exit(0)
}

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

// release.sh 通过命令替换读取 stdout，所以交互界面必须写到 stderr。
const screen = process.stderr
const styles = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  darkGray: "\x1b[90m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
}

if (!process.stdin.isTTY || !screen.isTTY) {
  fail(`当前终端不支持交互选择。请传入参数，或设置 ${config.env}。`)
}

let selectedIndex = 0

function optionLabel(option) {
  return config.labels?.[option] ? `${option} - ${config.labels[option]}` : option
}

function renderSelectedOptions() {
  if (kind === "channel") {
    return
  }

  screen.write(`\n  ${styles.bold}已选择${styles.reset}\n`)
  screen.write(`  发布通道：${channel} - ${channelLabels[channel]}\n`)

  if (target) {
    screen.write(`  发布目标：${target}\n`)
  }

  screen.write("\n")
}

function render() {
  readline.cursorTo(screen, 0, 0)
  readline.clearScreenDown(screen)
  screen.write(`  ${styles.bold}${config.title}${styles.reset}\n`)

  renderSelectedOptions()
  screen.write(`  ${styles.dim}使用方向键移动，Enter 确认，Esc 取消。${styles.reset}\n\n`)

  options.forEach((option, index) => {
    const label = optionLabel(option)

    if (index === selectedIndex) {
      screen.write(`${styles.bold}${styles.blue}› ${label}${styles.reset}\n`)
      return
    }

    screen.write(`${styles.darkGray}  ${label}${styles.reset}\n`)
  })
}

function finish(option) {
  process.stdin.setRawMode(false)
  process.stdin.off("keypress", handleKeypress)
  process.stdin.pause()
  readline.cursorTo(screen, 0, 0)
  readline.clearScreenDown(screen)
  process.stdout.write(`${option}\n`)
  process.exit(0)
}

function handleKeypress(_, key) {
  if (key.name === "up") {
    selectedIndex = (selectedIndex - 1 + options.length) % options.length
    render()
    return
  }

  if (key.name === "down") {
    selectedIndex = (selectedIndex + 1) % options.length
    render()
    return
  }

  if (key.name === "return" || key.name === "enter") {
    finish(options[selectedIndex])
    return
  }

  if (key.name === "escape" || (key.ctrl && key.name === "c")) {
    process.stdin.setRawMode(false)
    process.stdin.off("keypress", handleKeypress)
    readline.cursorTo(screen, 0)
    readline.clearScreenDown(screen)
    cancel()
  }
}

readline.emitKeypressEvents(process.stdin)
process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.on("keypress", handleKeypress)
render()
