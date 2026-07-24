import { existsSync, readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { discoverTargets, selectTargets } from "../lib/targets.mjs"
import { createTerminalSession } from "../lib/terminal-feedback/index.mjs"

import { packLocalPackages } from "./pack-local.mjs"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const examplesDir = resolve(rootDir, "examples")
const npmCacheDir = resolve(rootDir, "node_modules/.cache/npm")
const packages = discoverTargets("packages").map((target) => target.dir)

// 同步执行安装命令并将子进程输出直接交给调用终端。
async function run(session, command, args, cwd, label) {
  const result = await session.run({
    command,
    args,
    cwd,
    label,
  })

  if (result.code !== 0) {
    throw new Error(`${label} 失败（退出码：${result.code}）`)
  }
}

// 只向实际依赖 @schemx 包的示例安装本地 tarball。
function hasSchemxDependency(exampleDir) {
  const pkg = JSON.parse(readFileSync(resolve(exampleDir, "package.json"), "utf8"))
  const dependencyBlocks = [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies]

  return dependencyBlocks.some((dependencies) =>
    packages.some((name) => dependencies?.[`@schemx/${name}`])
  )
}

// 选择示例、打包 workspace 包，再逐个安装相对路径 tarball。
async function main() {
  const session = createTerminalSession()
  session.begin({ title: "Schemx" })
  const result = await selectTargets("examples", {
    title: "请选择要安装本地包的目标",
  })

  if (!result) {
    session.finish({ status: "cancel" })

    return
  }

  const exampleDirs = result.targets
    .map((target) => resolve(examplesDir, target.dir))
    .filter((dir) => existsSync(resolve(dir, "package.json")))

  if (exampleDirs.length === 0) {
    session.notice({ level: "warning", message: "没有选中的 example，无需安装。" })
    session.finish({ message: "无需执行" })

    return
  }

  // 先完成全部打包，确保每个示例使用同一批带时间戳的产物。
  session.section({
    title: "安装本地包",
    details: { 目标: result.targets.map((target) => target.name) },
  })
  const tarballs = await packLocalPackages(packages, { session })

  for (const exampleDir of exampleDirs) {
    if (!hasSchemxDependency(exampleDir)) {
      continue
    }

    const tarballArgs = packages.map((name) => relative(exampleDir, tarballs.get(name)))
    await run(
      session,
      "npm",
      [
        "install",
        "--no-save",
        "--package-lock=false",
        "--no-audit",
        "--fund=false",
        "--cache",
        relative(exampleDir, npmCacheDir),
        ...tarballArgs,
      ],
      exampleDir,
      `安装本地包到 ${relative(rootDir, exampleDir)}`
    )
  }

  session.finish()
}

try {
  await main()
} catch (error) {
  createTerminalSession().notice({ level: "error", message: error instanceof Error ? error.message : String(error) })
  process.exitCode = 1
}
