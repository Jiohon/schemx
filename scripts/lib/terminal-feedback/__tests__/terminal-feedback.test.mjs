import { EventEmitter } from "node:events"

import { describe, expect, test } from "vitest"

import { runTerminalBridge } from "../bridge.mjs"
import { processFailure, runProcess, runQuietProcess } from "../process.mjs"
import { createTerminalSession } from "../session.mjs"
import { createTerminalUi } from "../ui.mjs"

function createStream({ isTTY = false } = {}) {
  let content = ""
  return {
    isTTY,
    write(chunk) {
      content += chunk
    },
    read() {
      return content
    },
  }
}

describe("terminal-feedback", () => {
  test("非交互 UI 将用户反馈写至 stderr 流", () => {
    const output = createStream()
    const errorOutput = createStream()
    const ui = createTerminalUi({ input: { isTTY: false }, output, errorOutput })

    ui.intro("构建")
    ui.details({ 目标: ["@schemx/core", "@schemx/vue"] })
    ui.kv("通道", "alpha", 8)
    ui.success("完成")
    ui.error("失败")

    expect(output.read()).toContain("构建")
    expect(output.read()).toContain("@schemx/core、@schemx/vue")
    expect(output.read()).toContain("通道    alpha")
    expect(errorOutput.read()).toContain("✖ 失败")
  })

  test("NO_COLOR 优先于 FORCE_COLOR", () => {
    const output = createStream({ isTTY: true })
    const previousNoColor = process.env.NO_COLOR
    const previousForceColor = process.env.FORCE_COLOR
    process.env.NO_COLOR = "1"
    process.env.FORCE_COLOR = "1"

    try {
      createTerminalUi({ input: { isTTY: true }, output }).success("完成")
    } finally {
      if (previousNoColor === undefined) delete process.env.NO_COLOR
      else process.env.NO_COLOR = previousNoColor
      if (previousForceColor === undefined) delete process.env.FORCE_COLOR
      else process.env.FORCE_COLOR = previousForceColor
    }

    expect(output.read()).not.toContain("\u001B[")
  })

  test("会话在命令成功后输出任务耗时", async () => {
    const output = createStream()
    const ui = createTerminalUi({ input: { isTTY: false }, output })
    const session = createTerminalSession({
      ui,
      runner: async () => ({ code: 0, signal: null, error: null, duration: 125 }),
    })

    await session.run({ label: "构建 core", command: "pnpm", args: ["build"] })

    expect(output.read()).toContain("$ pnpm build")
    expect(output.read()).toContain("✓ 构建 core（125ms）")
  })

  test("会话间隔输出引导线，不影响任务日志", () => {
    const output = createStream()
    const session = createTerminalSession({
      ui: createTerminalUi({ input: { isTTY: false }, output }),
    })

    session.gap()

    expect(output.read()).toBe("│\n")
  })

  test("失败结果保留退出码与任务标签", () => {
    const error = processFailure(
      { command: "pnpm", args: ["build"], code: 1, signal: null, error: null },
      { label: "构建 core" },
    )

    expect(error.message).toBe("构建 core 失败（退出码：1）")
  })

  test("进程运行器返回退出码与耗时", async () => {
    const signalEmitter = new EventEmitter()
    const result = await runProcess({
      command: process.execPath,
      args: ["-e", "process.exit(0)"],
      signalEmitter,
    })

    expect(result.code).toBe(0)
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(signalEmitter.listenerCount("SIGINT")).toBe(0)
    expect(signalEmitter.listenerCount("SIGTERM")).toBe(0)
  })

  test("进程运行器保留非零退出码与启动失败", async () => {
    const failed = await runProcess({
      command: process.execPath,
      args: ["-e", "process.exit(7)"],
    })
    const unavailable = await runProcess({ command: "schemx-command-does-not-exist" })

    expect(failed).toMatchObject({ code: 7, signal: null, cancelled: false })
    expect(unavailable).toMatchObject({ code: 1, signal: null, cancelled: false })
    expect(unavailable.error).toBeInstanceOf(Error)
  })

  test.each([
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ])("进程运行器转发 %s 并清理监听器", async (signal, code) => {
    const signalEmitter = new EventEmitter()
    const running = runProcess({
      command: process.execPath,
      args: ["-e", "setInterval(() => {}, 1000)"],
      signalEmitter,
    })

    await new Promise((resolve) => setTimeout(resolve, 25))
    signalEmitter.emit(signal)
    const result = await running

    expect(result).toMatchObject({ code, signal, cancelled: true })
    expect(signalEmitter.listenerCount("SIGINT")).toBe(0)
    expect(signalEmitter.listenerCount("SIGTERM")).toBe(0)
  })

  test("静默运行器捕获机器可读 stdout", async () => {
    const result = await runQuietProcess({
      command: process.execPath,
      args: ["-e", "process.stdout.write('{\\\"ok\\\":true}')"],
    })

    expect(result.code).toBe(0)
    expect(result.stdout).toBe('{"ok":true}')
  })

  test("静默运行器捕获 stderr 并标识截断", async () => {
    const result = await runQuietProcess({
      command: process.execPath,
      args: ["-e", "process.stdout.write('0123456789'); process.stderr.write('abcdefghij')"],
      tailLimit: 5,
    })

    expect(result).toMatchObject({
      code: 0,
      stdout: "56789",
      stderr: "fghij",
      stdoutTruncated: true,
      stderrTruncated: true,
    })
  })

  test("静默命令失败时显示截断提示与日志尾部", async () => {
    const output = createStream()
    const errorOutput = createStream()
    const session = createTerminalSession({
      ui: createTerminalUi({ input: { isTTY: false }, output, errorOutput }),
      quietRunner: async () => ({
        code: 1,
        signal: null,
        cancelled: false,
        error: null,
        duration: 1,
        stdout: "stdout tail",
        stderr: "stderr tail",
        stdoutTruncated: true,
        stderrTruncated: false,
      }),
    })

    await session.run({ label: "读取元数据", command: "pnpm", quiet: true })

    expect(errorOutput.read()).toContain("日志已截断")
    expect(errorOutput.read()).toContain("stderr tail")
    expect(errorOutput.read()).toContain("stdout tail")
  })

  test("错误会话以错误样式结束，取消会话保留取消样式", () => {
    const output = createStream()
    const errorOutput = createStream()
    const session = createTerminalSession({
      ui: createTerminalUi({ input: { isTTY: false }, output, errorOutput }),
    })

    session.finish({ status: "error", message: "执行失败" })
    session.finish({ status: "cancel", message: "已取消" })

    expect(errorOutput.read()).toContain("✖ 执行失败")
  })

  test("Bash 桥接拒绝未知或不完整指令", () => {
    const output = createStream()
    const errorOutput = createStream()
    const ui = createTerminalUi({ input: { isTTY: false }, output, errorOutput })

    expect(runTerminalBridge(["unknown", "消息"], { ui })).toBe(2)
    expect(errorOutput.read()).toContain("用法：")
  })
})
