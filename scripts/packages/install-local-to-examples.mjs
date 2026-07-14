import { existsSync, readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { packLocalPackages } from "./pack-local.mjs"
import { printSection } from "../lib/terminal.mjs"
import { discoverTargets, selectTargets } from "../lib/targets.mjs"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const examplesDir = resolve(rootDir, "examples")
const npmCacheDir = resolve(rootDir, "node_modules/.cache/npm")
const packages = discoverTargets("packages").map((target) => target.dir)

// 同步执行安装命令并将子进程输出直接交给调用终端。
function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    encoding: "utf8",
  })

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} 执行失败`)
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
  const result = await selectTargets("examples", {
    title: "请选择要安装本地包的目标",
  })

  if (!result) {
    return
  }

  const exampleDirs = result.targets
    .map((target) => resolve(examplesDir, target.dir))
    .filter((dir) => existsSync(resolve(dir, "package.json")))

  if (exampleDirs.length === 0) {
    console.log("没有选中的 example，无需安装。")
    return
  }

  // 先完成全部打包，确保每个示例使用同一批带时间戳的产物。
  const tarballs = packLocalPackages(packages)

  for (const exampleDir of exampleDirs) {
    if (!hasSchemxDependency(exampleDir)) {
      continue
    }

    const tarballArgs = packages.map((name) => relative(exampleDir, tarballs.get(name)))
    printSection(`安装本地 @schemx tarball 到 ${relative(rootDir, exampleDir)}`)
    run(
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
      exampleDir
    )
  }
}

await main()
