import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { packLocalPackages } from "./pack-local-packages.mjs"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const examplesDir = resolve(rootDir, "examples")
const npmCacheDir = resolve(rootDir, "node_modules/.cache/npm")
const packages = ["core", "vue", "vant"]

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

function listExampleDirs(names) {
  const allExamples = readdirSync(examplesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  const targets = names.length > 0 ? names : allExamples
  const unknown = targets.filter((name) => !allExamples.includes(name))
  if (unknown.length > 0) {
    throw new Error(`未知 example：${unknown.join(", ")}，可选值为 ${allExamples.join(", ")}`)
  }

  return targets
    .map((name) => resolve(examplesDir, name))
    .filter((dir) => existsSync(resolve(dir, "package.json")))
}

function hasSchemxDependency(exampleDir) {
  const pkg = JSON.parse(readFileSync(resolve(exampleDir, "package.json"), "utf8"))
  const dependencyBlocks = [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies]

  return dependencyBlocks.some((dependencies) =>
    packages.some((name) => dependencies?.[`@schemx/${name}`]),
  )
}

const exampleDirs = listExampleDirs(process.argv.slice(2))
const tarballs = packLocalPackages(packages)

for (const exampleDir of exampleDirs) {
  if (!hasSchemxDependency(exampleDir)) {
    continue
  }

  const tarballArgs = packages.map((name) => relative(exampleDir, tarballs.get(name)))
  console.log(`安装本地 @schemx tarball 到 ${relative(rootDir, exampleDir)}`)
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
    exampleDir,
  )
}
