import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const packages = ["core", "vue", "vant"]

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  })

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} 执行失败`)
  }

  return result.stdout ?? ""
}

function normalizeTargets(argv) {
  if (argv.length === 0 || argv.includes("all")) {
    return packages
  }

  const unknown = argv.filter((name) => !packages.includes(name))
  if (unknown.length > 0) {
    throw new Error(`未知包：${unknown.join(", ")}，可选值为 ${packages.join(", ")}`)
  }

  return packages.filter((name) => {
    if (name === "core") {
      return argv.includes("core") || argv.includes("vue") || argv.includes("vant")
    }

    if (name === "vue") {
      return argv.includes("vue") || argv.includes("vant")
    }

    return argv.includes(name)
  })
}

export function packLocalPackages(targets = packages) {
  const tarballs = new Map()

  for (const target of targets) {
    run("pnpm", ["--filter", `@schemx/${target}`, "build"])

    const output = run(
      "pnpm",
      ["--filter", `@schemx/${target}`, "pack", "--pack-destination", rootDir, "--json"],
      { capture: true },
    )
    const parsedOutput = JSON.parse(output)
    const packResult = Array.isArray(parsedOutput) ? parsedOutput[0] : parsedOutput
    tarballs.set(target, resolve(rootDir, packResult.filename))
  }

  return tarballs
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const targets = normalizeTargets(process.argv.slice(2))
  const tarballs = packLocalPackages(targets)

  for (const [name, filePath] of tarballs) {
    console.log(`@schemx/${name}: ${filePath}`)
  }
}
