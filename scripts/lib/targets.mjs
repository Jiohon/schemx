import { groupMultiselect, isCancel, cancel as cancelPrompt } from "@clack/prompts"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

const VALID_SCOPES = ["packages", "plugins", "examples"]
const SCOPE_LABELS = {
  packages: "Packages",
  plugins: "Plugins",
  examples: "Examples",
}
const TASK_SCRIPT_WHITELIST = {
  build: ["build", "build:h5"],
  dev: ["dev", "dev:h5"],
}

/**
 * 解析任务在一个目标中实际应执行的 npm script。
 *
 * `dev` 与 `build` 可以映射到 H5 默认脚本，其他任务只匹配同名脚本。
 *
 * @param {Record<string, string>} scripts - 目标 package.json 的 scripts
 * @param {string} task - 根命令请求的任务名
 * @returns {string | undefined} 命中的实际 script 名
 */
export function resolveTaskScript(scripts, task) {
  const candidates = TASK_SCRIPT_WHITELIST[task] ?? [task]

  return candidates.find((script) => Boolean(scripts[script]))
}

/**
 * 发现某个 scope 下所有可执行目标。
 *
 * @param {string} scope - packages | plugins | examples
 * @returns {{ dir: string, name: string, scope: string, scripts: Record<string, string> }[]}
 */
export function discoverTargets(scope) {
  if (!VALID_SCOPES.includes(scope)) {
    throw new Error(`未知 scope：${scope}，可选值为 ${VALID_SCOPES.join("、")}`)
  }

  const base = resolve(rootDir, scope)
  let entries

  try {
    entries = readdirSync(base, { withFileTypes: true })
  } catch {
    return []
  }

  const targets = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    let pkg

    try {
      pkg = JSON.parse(readFileSync(resolve(base, entry.name, "package.json"), "utf8"))
    } catch {
      continue
    }

    targets.push({
      dir: entry.name,
      name: pkg.name,
      scope,
      scripts: pkg.scripts ?? {},
    })
  }

  targets.sort((left, right) => left.dir.localeCompare(right.dir))

  return targets
}

// 统一 CLI 的逗号分隔参数和库调用的数组参数。
function normalizeScopes(scopes) {
  if (Array.isArray(scopes)) {
    return scopes
  }

  return String(scopes)
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)
}

/**
 * 发现多个 scope 下的可执行目标。
 *
 * @param {string[] | string} scopes - 一个或多个 scope
 * @returns {{ dir: string, name: string, scope: string, scripts: Record<string, string> }[]}
 */
export function discoverAllTargets(scopes) {
  return normalizeScopes(scopes).flatMap((scope) => discoverTargets(scope))
}

// 只有输入和错误输出均连接终端时才展示交互式选择器。
function isInteractive(options) {
  const { stdin = process.stdin, stderr = process.stderr } = options

  return Boolean(stdin?.isTTY && stderr?.isTTY)
}

// 将 task 快捷条件转换为可复用的目标筛选函数。
function resolveEligible(options) {
  if (options.eligible) {
    return options.eligible
  }

  if (options.task) {
    return (target) => Boolean(resolveTaskScript(target.scripts, options.task))
  }

  return () => true
}

// 按 scope 分组，供 @clack/prompts 展示分组多选项。
function buildGroupedOptions(scopeList, eligible) {
  const grouped = {}

  for (const scope of scopeList) {
    const label = SCOPE_LABELS[scope] ?? scope
    const items = discoverTargets(scope).filter(eligible)

    if (items.length > 0) {
      grouped[label] = items.map((target) => ({
        value: target,
        label: target.dir,
        hint: target.name,
      }))
    }
  }

  return grouped
}

// 处理可取消的终端选择，并统一返回目标数组或 null。
async function promptTargets(scopeList, options) {
  const { stderr = process.stderr, eligible } = options
  const grouped = buildGroupedOptions(scopeList, eligible)

  if (Object.keys(grouped).length === 0) {
    return []
  }

  const selected = await groupMultiselect({
    message: options.title ?? "请选择目标",
    options: grouped,
    required: true,
    output: stderr,
  })

  if (isCancel(selected)) {
    cancelPrompt("已取消选择", { output: stderr })
    return null
  }

  return selected.filter(Boolean)
}

/**
 * 在交互终端选择目标；非交互环境自动选择全部符合条件的目标。
 *
 * @param {string[] | string} scopes - 一个或多个 scope
 * @param {{ task?: string, eligible?: (target: *) => boolean, title?: string, stdin?: *, stderr?: * }} [options] - 选择选项
 * @returns {Promise<{ targets: *, source: string } | null>} 取消时返回 null
 */
export async function selectTargets(scopes, options = {}) {
  const scopeList = normalizeScopes(scopes)
  const eligible = resolveEligible(options)

  if (!isInteractive(options)) {
    return {
      targets: discoverAllTargets(scopeList).filter(eligible),
      source: "default-all",
    }
  }

  const targets = await promptTargets(scopeList, { ...options, eligible })

  if (targets === null) {
    return null
  }

  return { targets, source: "prompt" }
}
