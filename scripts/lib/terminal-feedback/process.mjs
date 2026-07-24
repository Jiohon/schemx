import { spawn } from "node:child_process"

const DEFAULT_TAIL_LIMIT = 1024 * 1024
const SIGNAL_EXIT_CODES = {
  SIGINT: 130,
  SIGTERM: 143,
}

function commandText(command, args) {
  return [command, ...args].join(" ")
}

function signalExitCode(signal) {
  return SIGNAL_EXIT_CODES[signal] ?? 1
}

function appendTail(previous, chunk, limit) {
  const next = `${previous}${chunk}`

  if (next.length <= limit) return { value: next, truncated: false }

  return { value: next.slice(-limit), truncated: true }
}

function runChild({
  command,
  args = [],
  cwd,
  env,
  signalEmitter = process,
  quiet = false,
  tailLimit = DEFAULT_TAIL_LIMIT,
} = {}) {
  const startedAt = performance.now()
  const limit = Number.isFinite(tailLimit) ? Math.max(0, tailLimit) : DEFAULT_TAIL_LIMIT

  return new Promise((resolve) => {
    let child
    let settled = false
    let interruptionSignal = null
    let stdout = ""
    let stderr = ""
    let stdoutTruncated = false
    let stderrTruncated = false
    const cleanup = () => {
      signalEmitter.removeListener?.("SIGINT", onSigint)
      signalEmitter.removeListener?.("SIGTERM", onSigterm)
    }

    const finish = ({ code, signal = null, error = null }) => {
      if (settled) return
      settled = true
      cleanup()

      const finalSignal = signal ?? interruptionSignal
      const result = {
        command,
        args,
        code: finalSignal ? signalExitCode(finalSignal) : code ?? 1,
        signal: finalSignal,
        cancelled: Boolean(finalSignal),
        error,
        duration: performance.now() - startedAt,
      }

      if (quiet) {
        result.stdout = stdout
        result.stderr = stderr
        result.stdoutTruncated = stdoutTruncated
        result.stderrTruncated = stderrTruncated
      }

      resolve(result)
    }

    const forwardSignal = (signal) => {
      if (settled || interruptionSignal) return
      interruptionSignal = signal
      child?.kill(signal)
    }

    const onSigint = () => forwardSignal("SIGINT")
    const onSigterm = () => forwardSignal("SIGTERM")

    signalEmitter.on?.("SIGINT", onSigint)
    signalEmitter.on?.("SIGTERM", onSigterm)

    try {
      child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
        shell: process.platform === "win32",
        stdio: quiet ? ["inherit", "pipe", "pipe"] : "inherit",
      })
    } catch (error) {
      finish({ code: 1, error })

      return
    }

    if (quiet) {
      child.stdout?.on("data", (chunk) => {
        const next = appendTail(stdout, chunk.toString(), limit)
        stdout = next.value
        stdoutTruncated ||= next.truncated
      })
      child.stderr?.on("data", (chunk) => {
        const next = appendTail(stderr, chunk.toString(), limit)
        stderr = next.value
        stderrTruncated ||= next.truncated
      })
    }

    child.once("error", (error) => {
      finish({ code: 1, error })
    })
    child.once("close", (code, signal) => {
      finish({ code, signal })
    })
  })
}

/**
 * 原样继承终端流执行命令。用于 build、test、check、lint、publish 等用户应看到完整日志的任务。
 */
export function runProcess(options = {}) {
  return runChild(options)
}

/**
 * 静默执行机器可读或内部探测命令，并保留有限 stdout/stderr 尾部。
 * 不应用于构建、测试、检查或发布等用户需要实时日志的任务。
 */
export function runQuietProcess(options = {}) {
  return runChild({ ...options, quiet: true })
}

/** 将失败结果转为含执行上下文的 Error。 */
export function processFailure(result, { label = commandText(result.command, result.args) } = {}) {
  const reason = result.error
    ? result.error.message
    : result.signal
      ? `被信号 ${result.signal} 中断`
      : `退出码：${result.code}`

  return new Error(`${label} 失败（${reason}）`)
}
