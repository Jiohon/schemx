import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))

const defaultPackageRoots = {
  core: resolve(scriptDirectory, "../../../packages/core"),
  vant: resolve(scriptDirectory, "../../../packages/vant"),
  vue: resolve(scriptDirectory, "../../../packages/vue"),
}

/**
 * 确认源码模式所引用的 workspace 包已安装其直接依赖。
 *
 * @param {Record<string, string>} packageRoots - 源码包目录映射。
 */
export function assertSourceDependencies(packageRoots = defaultPackageRoots) {
  const missingDependencies = []

  for (const packageRoot of Object.values(packageRoots)) {
    const packageJsonPath = resolve(packageRoot, "package.json")
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    for (const dependency of Object.keys(packageJson.dependencies ?? {})) {
      if (!existsSync(resolve(packageRoot, "node_modules", dependency))) {
        missingDependencies.push(`${packageJson.name} 缺少 ${dependency}`)
      }
    }
  }

  if (missingDependencies.length > 0) {
    throw new Error(
      `源码模式依赖未安装：${missingDependencies.join("；")}。\n` +
        "请在仓库根目录执行 pnpm install，然后重新启动 UniApp。"
    )
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    assertSourceDependencies()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
