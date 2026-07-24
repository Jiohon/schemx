import { processFailure, runProcess, runQuietProcess } from "./process.mjs"
import { createTerminalUi } from "./ui.mjs"

function formatDuration(milliseconds) {
  return milliseconds < 1000 ? `${Math.round(milliseconds)}ms` : `${(milliseconds / 1000).toFixed(2)}s`
}

/**
 * 组合命令的通用生命周期；不在外部命令运行期间使用动态 Spinner。
 */
export function createTerminalSession({ ui = createTerminalUi(), runner = runProcess, quietRunner = runQuietProcess } = {}) {
  return {
    begin({ title = "Schemx" } = {}) {
      ui.intro(title)
    },
    context(entries) {
      ui.details(entries)
    },
    section({ title, details } = {}) {
      ui.section(title)
      if (details) ui.details(details)
    },
    gap() {
      ui.guide()
    },
    notice({ level = "info", message }) {
      const method = level === "warning" ? "warn" : level
      ui[method](message)
    },
    async run({ label, command, args = [], cwd, env, quiet = false, signalEmitter, tailLimit }) {
      ui.task(`${label}\n  $ ${[command, ...args].join(" ")}`)
      const result = await (quiet ? quietRunner : runner)({
        command,
        args,
        cwd,
        env,
        signalEmitter,
        tailLimit,
      })

      if (result.code === 0 && !result.signal && !result.error) {
        ui.success(`${label}（${formatDuration(result.duration)}）`)

        return result
      }

      const capturedOutput = [result.stderr, result.stdout].filter(Boolean).join("\n")
      const truncationNotice = result.stdoutTruncated || result.stderrTruncated
        ? "\n日志已截断，仅保留最近 1 MiB 输出。"
        : ""
      ui.error(`${processFailure(result, { label }).message}${truncationNotice}${capturedOutput ? `\n${capturedOutput}` : ""}`)

      return result
    },
    finish({ status = "success", message } = {}) {
      if (status === "success") ui.outro(message ?? "完成")
      else if (status === "cancel") ui.cancel(message ?? "已取消")
      else ui.error(message ?? "执行失败")
    },
  }
}
