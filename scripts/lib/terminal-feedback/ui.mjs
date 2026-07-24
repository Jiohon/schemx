import * as clack from "@clack/prompts"
import picocolors from "picocolors"

function colorsEnabled(output) {
  if (process.env.NO_COLOR) return false

  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== "0") return true

  if (process.env.CLICOLOR_FORCE === "1") return true

  return Boolean(output?.isTTY)
}

function normalizeDetails(entries) {
  return Array.isArray(entries) ? entries : Object.entries(entries ?? {})
}

function displayWidth(value) {
  let width = 0

  for (const character of String(value)) {
    const code = character.codePointAt(0) ?? 0
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f000 && code <= 0x1faff)
    width += wide ? 2 : 1
  }

  return width
}

/**
 * 创建当前工程脚本共用的终端 UI。
 * 用户反馈写入 stderr，stdout 保留给可被 Shell 消费的数据。
 */
export function createTerminalUi({
  input = process.stdin,
  output = process.stderr,
  errorOutput = process.stderr,
} = {}) {
  const color = picocolors.createColors(colorsEnabled(output))
  const interactive = Boolean(input?.isTTY && output?.isTTY)
  const write = (message) => output.write(`${message}\n`)
  const render = (symbol, message, paint = (value) => value) => {
    write(`${paint(symbol)} ${String(message).replace(/\r?\n/g, "\n  ")}`)
  }

  const promptOptions = (options = {}) => ({ input, output, ...options })

  return {
    interactive,
    color,
    intro(title = "Schemx") {
      if (interactive) clack.intro(title, { output })
      else write(title)
    },
    outro(message = "完成") {
      if (interactive) clack.outro(message, { output })
      else write(`${color.green("└")} ${message}`)
    },
    section(title) {
      write(`\n${color.cyan("◇")} ${color.bold(title)}`)
    },
    guide() {
      write(color.dim("│"))
    },
    info(message) {
      render("◇", message, color.cyan)
    },
    task(message) {
      render("●", message, color.cyan)
    },
    step(message) {
      render("●", message, color.cyan)
    },
    success(message) {
      render("✓", message, color.green)
    },
    warn(message) {
      render("▲", message, color.yellow)
    },
    error(message) {
      errorOutput.write(`${color.red("✖")} ${String(message).replace(/\r?\n/g, "\n  ")}\n`)
    },
    details(entries) {
      for (const [label, value] of normalizeDetails(entries)) {
        write(`${color.dim("│")} ${String(label)}  ${Array.isArray(value) ? value.join("、") : value}`)
      }
    },
    kv(label, value, width = 8) {
      const text = String(label)
      const padding = " ".repeat(Math.max(1, width - displayWidth(text)))
      write(`${color.dim("│")} ${text}${padding}${value}`)
    },
    select(options) {
      return clack.select(promptOptions(options))
    },
    multiselect(options) {
      return clack.multiselect(promptOptions(options))
    },
    groupMultiselect(options) {
      return clack.groupMultiselect({ selectableGroups: true, ...promptOptions(options) })
    },
    confirm(options) {
      return clack.confirm(promptOptions(options))
    },
    cancel(message = "已取消") {
      clack.cancel(message, promptOptions())
    },
    isCancelled: clack.isCancel,
  }
}

export const terminalUi = createTerminalUi()
