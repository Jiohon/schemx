#!/usr/bin/env node

import { createColors } from "picocolors"

import { printSection } from "../lib/terminal.mjs"

const [command = "", ...args] = process.argv.slice(2)

// 支持标准禁用/强制颜色环境变量，并在非 TTY 时默认关闭颜色。
function colorsEnabled() {
  if (process.env.NO_COLOR) {
    return false
  }

  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== "0") {
    return true
  }

  if (process.env.CLICOLOR_FORCE === "1") {
    return true
  }

  return process.stdout.isTTY
}

const color = createColors(colorsEnabled())

// 中文等宽字符按两个终端列计算，确保键值输出对齐。
function displayWidth(value) {
  let width = 0

  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    width += code > 0xff ? 2 : 1
  }

  return width
}

// 按显示宽度而非字符串长度补齐标签。
function padLabel(label, width) {
  return label + " ".repeat(Math.max(1, width - displayWidth(label)))
}

// 保留多行提示的换行语义，供 success/warn/error 共用。
function lines(message) {
  return message.split(/\r?\n/)
}

// 集中输出入口，方便所有 UI 分支使用同一流。
function write(value) {
  process.stdout.write(value)
}

// 复用仓库统一的阶段横幅。
function section(title) {
  printSection(title, { output: process.stdout })
}

// 为每个非空行添加成功标识。
function success(message) {
  for (const line of lines(message)) {
    if (line) {
      write(`${color.green(`✓ ${line}`)}\n`)
    }
  }
}

// 首行突出警告标识，后续行保持缩进以便阅读长提示。
function warn(message) {
  const [first = "", ...rest] = lines(message)

  if (first) {
    write(`${color.yellow(`! ${first}`)}\n`)
  }

  for (const line of rest) {
    write(line ? `${color.yellow(`  ${line}`)}\n` : "\n")
  }
}

// 错误始终保留首行前缀，后续行用于承载详细原因。
function error(message) {
  const [first = "", ...rest] = lines(message)

  write(`${color.red(`✖ 错误：${first}`)}\n`)
  for (const line of rest) {
    write(line ? `${color.red(`  ${line}`)}\n` : "\n")
  }
}

// 输出可配置宽度的键值行。
function kv(label, value, width = "8") {
  write(`  ${padLabel(label, Number(width))}${value}\n`)
}

switch (command) {
  case "section":
    section(args.join(" "))
    break
  case "success":
    success(args.join(" "))
    break
  case "warn":
    warn(args.join(" "))
    break
  case "error":
    error(args.join(" "))
    break
  case "kv":
    kv(args[0] ?? "", args[1] ?? "", args[2] ?? "8")
    break
  default:
    error(`未知 release UI 命令：${command || "(empty)"}`)
    process.exit(1)
}
