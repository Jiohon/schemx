#!/usr/bin/env node

import { createTerminalSession, terminalUi } from "./lib/terminal-feedback/index.mjs"

const [command, ...args] = process.argv.slice(2)

function usage() {
  terminalUi.error([
    "用法：",
    "  node scripts/terminal.mjs <intro|outro|section|info|step|success|warn|error> <消息>",
    "  node scripts/terminal.mjs kv <标签> <值> [宽度]",
    "  node scripts/terminal.mjs task <标题> -- <命令> [参数...]",
  ].join("\n"))
}

function splitTaskArgs(values) {
  const separator = values.indexOf("--")
  if (separator < 1 || separator === values.length - 1) return null

  return {
    label: values.slice(0, separator).join(" "),
    command: values[separator + 1],
    commandArgs: values.slice(separator + 2),
  }
}

if (!command) {
  usage()
  process.exit(1)
}

if (command === "task") {
  const task = splitTaskArgs(args)
  if (!task) {
    usage()
    process.exit(1)
  }

  const result = await createTerminalSession().run({
    command: task.command,
    args: task.commandArgs,
    label: task.label,
  })
  if (result.code !== 0) process.exitCode = result.code
} else if (command === "kv") {
  if (args.length < 2) {
    usage()
    process.exit(1)
  }

  terminalUi.kv(args[0], args[1], Number(args[2] ?? "10"))
} else if (command === "intro" || command === "outro" || command === "section" || command === "info" || command === "step" || command === "success" || command === "warn" || command === "error") {
  if (args.length === 0) {
    usage()
    process.exit(1)
  }

  terminalUi[command](args.join(" "))
} else {
  usage()
  process.exit(1)
}
