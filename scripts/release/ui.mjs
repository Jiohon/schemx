#!/usr/bin/env node

import { createColors } from "picocolors"

const [command = "", ...args] = process.argv.slice(2)

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

function displayWidth(value) {
  let width = 0

  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    width += code > 0xff ? 2 : 1
  }

  return width
}

function padLabel(label, width) {
  return label + " ".repeat(Math.max(1, width - displayWidth(label)))
}

function lines(message) {
  return message.split(/\r?\n/)
}

function write(value) {
  process.stdout.write(value)
}

function section(title) {
  write(`\n${color.cyan(color.bold(`◆ ${title}`))}\n`)
}

function success(message) {
  for (const line of lines(message)) {
    if (line) {
      write(`${color.green(`✓ ${line}`)}\n`)
    }
  }
}

function warn(message) {
  const [first = "", ...rest] = lines(message)

  if (first) {
    write(`${color.yellow(`! ${first}`)}\n`)
  }

  for (const line of rest) {
    write(line ? `${color.yellow(`  ${line}`)}\n` : "\n")
  }
}

function error(message) {
  const [first = "", ...rest] = lines(message)

  write(`${color.red(`✖ 错误：${first}`)}\n`)
  for (const line of rest) {
    write(line ? `${color.red(`  ${line}`)}\n` : "\n")
  }
}

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
