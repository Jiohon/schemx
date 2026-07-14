#!/usr/bin/env node
/**
 * 通用目标选择器。
 *
 * 统一 packages / plugins / examples 三类目标的选择逻辑，供根命令运行器
 * （run-with-targets.mjs）以及 pack-local / install-local-to-examples 等自定义脚本复用。
 *
 * 解析规则：
 *   1. TTY -> @clack/prompts groupMultiselect（按 scope 分组，可勾选组头批量选择）；
 *   2. 非 TTY -> 默认全部（让 CI / 自动化开箱即用）。
 *
 * 目标列表由文件系统发现：扫描 <scope>/ 下含 package.json 的子目录，
 * 自动忽略无 package.json 的残留目录（如 packages/wot、examples/wot-demo）。
 */

import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export { discoverAllTargets, discoverTargets, selectTargets } from "./lib/targets.mjs"
import { selectTargets } from "./lib/targets.mjs"

/**
 * 判断当前文件是否作为命令行入口直接执行。
 *
 * @returns {boolean}
 */
function isMainModule() {
  const entryFilePath = process.argv[1]

  if (!entryFilePath) {
    return false
  }

  return import.meta.url === pathToFileURL(resolve(entryFilePath)).href
}

// 将目标选择库暴露为一行一个目录名的 CLI，便于 Shell 脚本消费。
async function runCli() {
  const args = process.argv.slice(2)
  const scopesArg = args.find((arg) => !arg.startsWith("--"))
  const taskIndex = args.indexOf("--task")
  const task = taskIndex !== -1 ? args[taskIndex + 1] : undefined
  const titleIndex = args.indexOf("--title")
  const title = titleIndex !== -1 ? args[titleIndex + 1] : undefined

  if (!scopesArg) {
    process.stderr.write(
      "用法：node select-targets.mjs <scopes> [--task <task>] [--title <title>]\n"
    )
    process.stderr.write("  scopes: packages,plugins,... （逗号分隔）\n")
    process.exit(1)
  }

  const result = await selectTargets(scopesArg, { task, title })

  if (!result) {
    // 已取消：退出 0，不输出目标。
    process.exit(0)
  }

  for (const target of result.targets) {
    process.stdout.write(`${target.dir}\n`)
  }
}

if (isMainModule()) {
  await runCli()
}
