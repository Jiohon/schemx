import { terminalUi } from "./ui.mjs"

/**
 * 为 Bash 调用提供无状态终端反馈桥接。
 * 每次调用只渲染一条静态信息，不能用于 Spinner 或跨进程会话。
 */
export function runTerminalBridge(argv, { ui = terminalUi } = {}) {
  const [action, ...args] = argv
  const message = args.join(" ")
  const supported = new Set(["intro", "outro", "info", "task", "success", "warn", "error"])

  if (!action || !supported.has(action) || !message) {
    ui.error("用法：terminal-feedback <intro|outro|info|task|success|warn|error> <消息>")

    return 2
  }

  ui[action](message)

  return 0
}
