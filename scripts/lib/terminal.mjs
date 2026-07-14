import { createColors } from "picocolors"

// 同时兼容 NO_COLOR、强制颜色变量和 TTY 自动判断。
function colorsEnabled(output) {
  if (process.env.NO_COLOR) {
    return false
  }

  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== "0") {
    return true
  }

  if (process.env.CLICOLOR_FORCE === "1") {
    return true
  }

  return Boolean(output?.isTTY)
}

/**
 * 输出用于分隔命令任务的统一横幅。
 *
 * @param {string} title - 当前任务标题
 * @param {{ output?: { write: (value: string) => void } }} [options] - 输出目标
 */
export function printSection(title, { output = process.stderr } = {}) {
  const color = createColors(colorsEnabled(output))
  const separator = color.cyan("----------")
  const coloredTitle = color.cyan(color.bold(title))

  output.write(`\n${separator} ${coloredTitle} ${separator}\n`)
}
