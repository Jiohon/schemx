import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const currentFilePath = fileURLToPath(import.meta.url)
const rootDir = resolve(dirname(currentFilePath), "..")
const packDir = resolve(rootDir, ".packs")

const packageNames = ["core", "vue", "vant"]

/**
 * 执行子进程命令。
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{
 *   cwd?: string
 *   capture?: boolean
 * }} options
 * @returns {string}
 */
function run(command, args, options = {}) {
  const capture = options.capture ?? false

  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    shell: process.platform === "win32",
  })

  if (result.error) {
    throw new Error(`${command} ${args.join(" ")} 启动失败：${result.error.message}`, {
      cause: result.error,
    })
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} 执行失败，退出码：${result.status}`)
  }

  return result.stdout ?? ""
}

/**
 * 根据命令行参数计算最终需要打包的包。
 *
 * 依赖关系：
 * vue -> core
 * vant -> vue -> core
 *
 * @param {string[]} argv
 * @returns {string[]}
 */
function normalizeTargets(argv) {
  if (argv.length === 0 || argv.includes("all")) {
    return [...packageNames]
  }

  const unknownNames = argv.filter((name) => !packageNames.includes(name))

  if (unknownNames.length > 0) {
    throw new Error(
      `未知包：${unknownNames.join(", ")}，可选值为：${[...packageNames, "all"].join(
        ", "
      )}`
    )
  }

  return packageNames.filter((name) => {
    if (name === "core") {
      return argv.includes("core") || argv.includes("vue") || argv.includes("vant")
    }

    if (name === "vue") {
      return argv.includes("vue") || argv.includes("vant")
    }

    return argv.includes("vant")
  })
}

/**
 * 格式化字节数。
 *
 * @param {number} bytes
 * @returns {string}
 */
function formatSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(2)} KB`
  }

  if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(2)} MB`
  }

  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

/**
 * 递归收集目录中的所有文件。
 *
 * @param {string} directory
 * @param {string} baseDirectory
 * @returns {{ path: string, size: number }[]}
 */
function collectFiles(directory, baseDirectory = directory) {
  const files = []

  function walk(currentDirectory) {
    const entries = readdirSync(currentDirectory, {
      withFileTypes: true,
    })

    for (const entry of entries) {
      const absolutePath = resolve(currentDirectory, entry.name)

      if (entry.isDirectory()) {
        walk(absolutePath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      files.push({
        path: relative(baseDirectory, absolutePath),
        size: statSync(absolutePath).size,
      })
    }
  }

  walk(directory)

  return files
}

/**
 * 分析一个 npm tarball。
 *
 * @param {string} tarballPath
 * @param {number} topCount
 * @returns {{
 *   compressedSize: number
 *   unpackedSize: number
 *   fileCount: number
 *   files: { path: string, size: number }[]
 *   largestFiles: { path: string, size: number }[]
 * }}
 */
function analyzeTarball(tarballPath, topCount = 20) {
  const tempDirectory = mkdtempSync(resolve(tmpdir(), "schemx-pack-analysis-"))

  try {
    run("tar", ["-xzf", tarballPath, "-C", tempDirectory], {
      cwd: rootDir,
    })

    const extractedPackageDirectory = resolve(tempDirectory, "package")

    const files = collectFiles(extractedPackageDirectory).sort(
      (left, right) => right.size - left.size
    )

    const unpackedSize = files.reduce((total, file) => total + file.size, 0)

    return {
      compressedSize: statSync(tarballPath).size,
      unpackedSize,
      fileCount: files.length,
      files,
      largestFiles: files.slice(0, topCount),
    }
  } finally {
    rmSync(tempDirectory, {
      recursive: true,
      force: true,
    })
  }
}

/**
 * 构建并打包本地 workspace 包。
 *
 * @param {string[]} targets
 * @returns {Map<string, string>}
 */
export function packLocalPackages(targets = packageNames) {
  mkdirSync(packDir, {
    recursive: true,
  })

  const tarballs = new Map()

  for (const target of targets) {
    const packageName = `@schemx/${target}`

    console.log()
    console.log(`构建 ${packageName}...`)

    run("pnpm", ["--filter", packageName, "build"])

    console.log(`打包 ${packageName}...`)

    const output = run(
      "pnpm",
      ["--filter", packageName, "pack", "--pack-destination", packDir, "--json"],
      {
        capture: true,
      }
    )

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

    const tarballPath = resolve(packDir, packResult.filename)

    tarballs.set(target, tarballPath)
  }

  return tarballs
}

/**
 * 打印 tarball 分析结果。
 *
 * @param {string} name
 * @param {string} tarballPath
 */
function printTarballAnalysis(name, tarballPath) {
  const packageName = `@schemx/${name}`
  const analysis = analyzeTarball(tarballPath)

  console.log()
  console.log("=".repeat(72))
  console.log(packageName)
  console.log("=".repeat(72))
  console.log(`文件路径：${tarballPath}`)
  console.log(`压缩大小：${formatSize(analysis.compressedSize)}`)
  console.log(`解压大小：${formatSize(analysis.unpackedSize)}`)
  console.log(`文件数量：${analysis.fileCount}`)
  console.log()
  console.log(`最大的 ${analysis.largestFiles.length} 个文件：`)

  for (const file of analysis.largestFiles) {
    console.log(`${formatSize(file.size).padStart(12)}  ${file.path}`)
  }
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

if (isMainModule()) {
  try {
    const targets = normalizeTargets(process.argv.slice(2))

    console.log(`待打包包：${targets.map((name) => `@schemx/${name}`).join(", ")}`)

    const tarballs = packLocalPackages(targets)

    for (const [name, tarballPath] of tarballs) {
      printTarballAnalysis(name, tarballPath)
    }

    console.log()
    console.log("=".repeat(72))
    console.log(`打包完成，产物目录：${packDir}`)
  } catch (error) {
    console.error()
    console.error(error instanceof Error ? error.message : String(error))

    process.exitCode = 1
  }
}
