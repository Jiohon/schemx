import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { discoverTargets, selectTargets } from "../lib/targets.mjs"
import { createTerminalSession } from "../lib/terminal-feedback/index.mjs"

const currentFilePath = fileURLToPath(import.meta.url)
const rootDir = resolve(dirname(currentFilePath), "../..")
const packDir = resolve(rootDir, ".packs")

const packageNames = discoverTargets("packages").map((target) => target.dir)

/**
 * 执行子进程命令。
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{
 *   cwd?: string
 *   label?: string
 *   quiet?: boolean
 * }} options
 * @returns {Promise<Awaited<ReturnType<import("../lib/terminal-feedback/process.mjs").runProcess>>>}
 */
async function run(command, args, options = {}) {
  const session = options.session ?? createTerminalSession()
  const result = await session.run({
    command,
    args,
    cwd: options.cwd ?? rootDir,
    label: options.label ?? `${command} ${args.join(" ")}`,
    quiet: options.quiet ?? false,
  })

  if (result.code !== 0) {
    throw new Error(`${command} ${args.join(" ")} 执行失败，退出码：${result.code}`)
  }

  return result
}

/**
 * 按依赖关系展开选中的包。
 *
 * 依赖关系：
 * vue -> core
 * vant -> vue -> core
 *
 * 目标选择（含 all 与未知值校验）已由 select-targets.mjs 完成，这里只负责
 * 把选中结果按依赖链补齐。
 *
 * @param {string[]} selected - 选中的包目录名
 * @returns {string[]}
 */
function expandTargets(selected) {
  return packageNames.filter((name) => {
    if (name === "core") {
      return (
        selected.includes("core") || selected.includes("vue") || selected.includes("vant")
      )
    }

    if (name === "vue") {
      return selected.includes("vue") || selected.includes("vant")
    }

    return selected.includes("vant")
  })
}

/**
 * 生成可用于 npm prerelease version 的本地时间戳。
 *
 * @param {Date} date
 * @returns {string}
 */
export function createPackTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0")

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("")
}

/**
 * 基于正式版本生成不会命中 npm 缓存的本地 pack 版本。
 *
 * @param {string} version
 * @param {string} timestamp
 * @returns {string}
 */
export function createTimestampedVersion(version, timestamp = createPackTimestamp()) {
  return `${version}-dev.${timestamp}`
}

/**
 * 基于本地 tarball 绝对路径生成可直接执行的安装命令。
 *
 * @param {string[]} tarballPaths - 本次打包生成的 tarball 路径
 * @returns {string}
 */
export function createInstallCommand(tarballPaths) {
  return `pnpm i ${tarballPaths.join(" ")}`
}

/**
 * @param {string} target
 * @returns {string}
 */
// 统一计算 workspace 包的 package.json 路径。
function packageJsonPath(target) {
  return resolve(rootDir, "packages", target, "package.json")
}

/**
 * @param {string} target
 * @returns {Record<string, unknown> & { version: string }}
 */
// 读取打包前的版本号，以便 finally 中无条件恢复。
function readPackageJson(target) {
  return JSON.parse(readFileSync(packageJsonPath(target), "utf8"))
}

/**
 * @param {string} target
 * @param {Record<string, unknown>} packageJson
 */
// 以稳定的两空格格式写回临时或原始版本号。
function writePackageJson(target, packageJson) {
  writeFileSync(packageJsonPath(target), `${JSON.stringify(packageJson, null, 2)}\n`)
}

// 从插件打包脚本的机器可读标记中提取 tarball，保留其余日志供用户查看。
function readReportedTarball(output, targetName) {
  const marker = "__SCHEMX_LOCAL_TARBALL__="
  const match = output.match(new RegExp(`${marker}(.+)$`, "m"))

  if (!match) {
    throw new Error(`${targetName} 打包完成后未返回本地 tarball 路径`)
  }

  return {
    tarballPath: match[1].trim(),
    output: output
      .split(/\r?\n/)
      .filter((line) => !line.includes(marker))
      .join("\n"),
  }
}

/**
 * 解析 pnpm pack 的机器可读结果；截断输出不能安全解析。
 *
 * @param {string} output
 * @param {{ packageName: string, truncated?: boolean }} options
 * @returns {{ filename: string }}
 */
export function parsePackOutput(output, { packageName, truncated = false }) {
  if (truncated) {
    throw new Error(`${packageName} 的机器可读输出已截断，无法安全解析`)
  }

  let parsedOutput

  try {
    parsedOutput = JSON.parse(output)
  } catch (error) {
    throw new Error(`${packageName} 的 pnpm pack 输出无法解析为 JSON：\n${output}`, {
      cause: error,
    })
  }

  const packResult = Array.isArray(parsedOutput) ? parsedOutput[0] : parsedOutput

  if (!packResult?.filename) {
    throw new Error(`${packageName} 的 pnpm pack 结果中缺少 filename`)
  }

  return packResult
}

/**
 * 构建并打包本地 workspace 包。
 *
 * @param {string[]} targets
 * @returns {Promise<Map<string, string>>}
 */
export async function packLocalPackages(targets = packageNames, { session = createTerminalSession() } = {}) {
  mkdirSync(packDir, {
    recursive: true,
  })

  const tarballs = new Map()
  const timestamp = createPackTimestamp()

  // 每个包临时改为唯一 prerelease 版本，以绕过包管理器的本地缓存。
  for (const target of targets) {
    const packageName = `@schemx/${target}`
    const packageJson = readPackageJson(target)
    const originalVersion = packageJson.version
    const packVersion = createTimestampedVersion(originalVersion, timestamp)

    writePackageJson(target, {
      ...packageJson,
      version: packVersion,
    })

    try {
      await run("pnpm", ["--filter", packageName, "build"], {
        label: `构建 ${packageName}`,
        session,
      })

      const packOutput = await run(
        "pnpm",
        ["--filter", packageName, "pack", "--pack-destination", packDir, "--json"],
        {
          label: `打包 ${packageName}`,
          quiet: true,
          session,
        }
      )

      const packResult = parsePackOutput(packOutput.stdout, {
        packageName,
        truncated: packOutput.stdoutTruncated,
      })

      const tarballPath = resolve(packDir, packResult.filename)

      tarballs.set(target, tarballPath)
    } finally {
      writePackageJson(target, {
        ...packageJson,
        version: originalVersion,
      })
    }
  }

  return tarballs
}

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

// 同时支持核心包和实现 pack:local 的插件，并输出可复制的安装命令。
async function main() {
  const session = createTerminalSession()
  session.begin({ title: "Schemx" })
  const result = await selectTargets(["packages", "plugins"], {
    eligible: (target) =>
      target.scope === "packages" || Boolean(target.scripts["pack:local"]),
    title: "请选择要本地打包的目标",
  })

  if (!result) {
    session.finish({ status: "cancel" })

    return
  }

  const packageDirs = result.targets
    .filter((target) => target.scope === "packages")
    .map((target) => target.dir)
  const pluginTargets = result.targets.filter((target) => target.scope === "plugins")
  const tarballPaths = []

  if (packageDirs.length > 0) {
    const targets = expandTargets(packageDirs)

    session.section({
      title: "本地打包",
      details: { 目标: targets.map((name) => `@schemx/${name}`) },
    })

    tarballPaths.push(...(await packLocalPackages(targets, { session })).values())
  }

  for (const target of pluginTargets) {
    const pluginOutput = await run("pnpm", ["--filter", target.name, "run", "pack:local"], {
      label: `打包插件 ${target.name}`,
      quiet: true,
      session,
    })
    if (pluginOutput.stdoutTruncated) {
      throw new Error(`${target.name} 的机器可读输出已截断，无法安全解析`)
    }

    const reported = readReportedTarball(pluginOutput.stdout, target.name)

    if (reported.output) {
      session.notice({ level: "info", message: reported.output })
    }

    tarballPaths.push(reported.tarballPath)
  }

  if (packageDirs.length === 0 && pluginTargets.length === 0) {
    session.notice({ level: "warning", message: "没有选中的目标，无需打包。" })
    session.finish({ message: "无需执行" })

    return
  }

  session.notice({ level: "success", message: `打包完成，产物目录：${packDir}` })
  session.section({ title: "安装方式", details: { 安装命令: createInstallCommand(tarballPaths) } })
  session.finish()
}

if (isMainModule()) {
  try {
    await main()
  } catch (error) {
    createTerminalSession().notice({ level: "error", message: error instanceof Error ? error.message : String(error) })

    process.exitCode = 1
  }
}
