# realpath fallback 详细日志实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 `@schemx/vite-plugin-realpath-fallback` 增加独立的 `detailedLog` 配置，完整输出每个受理解析请求的成功或失败结果，并删除重叠日志与不准确统计。

**架构：** 保持现有 Vite `resolveId` 与 realpath fallback 数据流不变，在每个终止分支调用统一的 `logResolveResult`。该函数根据结果状态选择 `logger.info` 或 `logger.warn`，并复用现有多行字段格式化函数。删除 `debugStandardResolve` 和统计汇总，仅在 `buildEnd` 清理 realpath 缓存。

**技术栈：** TypeScript、Vite Plugin API、Vitest、Node.js `fs`/`path`

---

## 文件结构

- 修改 `plugins/vite-plugin-realpath-fallback/src/__tests__/realpath-fallback-plugin.test.ts`：覆盖详细日志成功、失败、关闭状态与独立开关语义。
- 修改 `plugins/vite-plugin-realpath-fallback/src/realpath-fallback-plugin.ts`：新增公开配置并统一输出逐请求结果，删除重叠逻辑。
- 修改 `plugins/vite-plugin-realpath-fallback/README.md`：说明 `debug` 与 `detailedLog` 的职责和用法。

### 任务 1：用失败测试定义详细日志契约

**文件：**
- 修改：`plugins/vite-plugin-realpath-fallback/src/__tests__/realpath-fallback-plugin.test.ts`

- [ ] **步骤 1：添加日志捕获与插件配置辅助函数**

```ts
import type { Plugin } from "vite"

function configurePlugin(plugin: Plugin) {
  const infoMessages: string[] = []
  const warnMessages: string[] = []

  if (typeof plugin.configResolved !== "function") {
    throw new Error("Missing configResolved hook")
  }

  plugin.configResolved.call({} as never, {
    logger: {
      info: (message: string) => infoMessages.push(message),
      warn: (message: string) => warnMessages.push(message),
    },
    resolve: { preserveSymlinks: true },
  } as never)

  return { infoMessages, warnMessages }
}

async function callResolve(
  plugin: Plugin,
  resolve: (source: string, importer: string) => Promise<{ id: string } | null>,
  importer = "/app/node_modules/package/index.mjs"
) {
  if (typeof plugin.resolveId !== "function") {
    throw new Error("Missing resolveId hook")
  }

  return plugin.resolveId.call(
    { resolve } as never,
    "dependency",
    importer,
    {} as never
  )
}
```

- [ ] **步骤 2：添加标准解析成功与关闭日志测试**

```ts
test("detailedLog 独立于 debug 输出标准解析成功结果", async () => {
  const plugin = pluginModule.createRealpathFallbackPlugin({
    detailedLog: true,
    include: ["dependency"],
  })
  const { infoMessages, warnMessages } = configurePlugin(plugin)
  const resolved = { id: "/resolved/dependency.mjs" }

  const result = await callResolve(plugin, async () => resolved)

  expect(result).toEqual(resolved)
  expect(infoMessages).toHaveLength(1)
  expect(infoMessages[0]).toContain("status  : standard-resolved")
  expect(warnMessages).toEqual([])
})

test("未开启 detailedLog 时不输出逐请求结果", async () => {
  const plugin = pluginModule.createRealpathFallbackPlugin({
    include: ["dependency"],
  })
  const { infoMessages, warnMessages } = configurePlugin(plugin)

  await callResolve(plugin, async () => ({ id: "/resolved/dependency.mjs" }))

  expect(infoMessages).toEqual([])
  expect(warnMessages).toEqual([])
})
```

- [ ] **步骤 3：添加 fallback 成功与失败测试**

使用测试中现有的真实符号链接目录，并断言：

```ts
expect(infoMessages[0]).toContain("status      : fallback-resolved")
expect(infoMessages[0]).toContain(`realImporter: ${normalizedRealImporter}`)
expect(infoMessages[0]).toContain(`resolved    : ${expectedResolution}`)

expect(warnMessages[0]).toContain("status      : fallback-failed")
expect(warnMessages[0]).toContain(`realImporter: ${normalizedRealImporter}`)
```

- [ ] **步骤 4：添加真实路径未变化测试**

```ts
test("真实路径未变化时输出失败结果", async () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "schemx-realpath-fallback-")
  )
  temporaryDirectories.push(temporaryDirectory)
  const regularImporter = path.join(temporaryDirectory, "package/index.mjs")
  fs.mkdirSync(path.dirname(regularImporter), { recursive: true })
  fs.writeFileSync(regularImporter, "export {}\n")

  const plugin = pluginModule.createRealpathFallbackPlugin({
    detailedLog: true,
    include: ["dependency"],
  })
  const { warnMessages } = configurePlugin(plugin)

  await callResolve(plugin, async () => null, regularImporter)

  expect(warnMessages).toHaveLength(1)
  expect(warnMessages[0]).toContain("status      : realpath-unchanged")
})
```

- [ ] **步骤 5：运行测试确认按预期失败**

运行：

```bash
pnpm --dir plugins/vite-plugin-realpath-fallback test
```

预期：FAIL，TypeScript 或运行时结果表明 `detailedLog` 尚不存在，且没有 `resolve completed` 结果日志。

### 任务 2：实现统一详细日志并删除无用逻辑

**文件：**
- 修改：`plugins/vite-plugin-realpath-fallback/src/realpath-fallback-plugin.ts`
- 测试：`plugins/vite-plugin-realpath-fallback/src/__tests__/realpath-fallback-plugin.test.ts`

- [ ] **步骤 1：新增配置项与内部结果类型**

```ts
/**
 * 是否输出每次受理解析请求的详细结果。
 *
 * 成功与失败结果都会输出。
 *
 * @default false
 */
detailedLog?: boolean

type ResolveResultStatus =
  | "standard-resolved"
  | "fallback-resolved"
  | "invalid-importer"
  | "realpath-failed"
  | "realpath-unchanged"
  | "fallback-failed"
```

- [ ] **步骤 2：实现统一结果输出函数**

```ts
function logResolveResult(
  status: ResolveResultStatus,
  fields: Record<string, string | undefined>
): void {
  if (!options.detailedLog || !resolvedConfig) {
    return
  }

  const message = formatDebugMessage(
    "[realpath-fallback] resolve completed",
    { status, ...fields }
  )
  const succeeded =
    status === "standard-resolved" || status === "fallback-resolved"

  resolvedConfig.logger[succeeded ? "info" : "warn"](message)
}
```

- [ ] **步骤 3：让每个受理请求的终止分支恰好记录一次结果**

在 `standardResolved`、`invalid importer`、`realpath failed`、`realpath unchanged`、`fallback failed` 和 `fallback resolved` 分支分别调用：

```ts
logResolveResult("standard-resolved", {
  source,
  importer,
  resolved: standardResolved.id,
})
```

其余分支使用同样字段顺序，并只传递当前阶段可获得的数据。

- [ ] **步骤 4：删除重叠和不准确逻辑**

删除以下内容：

- `debugStandardResolve` 配置；
- `ResolveStatistics` 接口、`statistics` 实例及所有计数递增；
- `debugInfo`、`debugWarn`；
- `buildEnd` 中的 summary 日志。

保留精简后的缓存清理：

```ts
buildEnd() {
  realpathCache.clear()
},
```

- [ ] **步骤 5：运行插件测试确认通过**

运行：

```bash
pnpm --dir plugins/vite-plugin-realpath-fallback test
```

预期：PASS，详细日志与原有 fallback 测试全部通过。

- [ ] **步骤 6：提交行为变更**

```bash
git add plugins/vite-plugin-realpath-fallback/src/realpath-fallback-plugin.ts plugins/vite-plugin-realpath-fallback/src/__tests__/realpath-fallback-plugin.test.ts
git commit --only plugins/vite-plugin-realpath-fallback/src/realpath-fallback-plugin.ts plugins/vite-plugin-realpath-fallback/src/__tests__/realpath-fallback-plugin.test.ts -m "feat(plugin): 添加 realpath fallback 详细日志"
```

### 任务 3：精简注释并补充使用文档

**文件：**
- 修改：`plugins/vite-plugin-realpath-fallback/src/realpath-fallback-plugin.ts`
- 修改：`plugins/vite-plugin-realpath-fallback/README.md`

- [ ] **步骤 1：精简实现注释**

删除 `resolveId` 中仅复述「第一阶段」「第二阶段」「第三阶段」「第四阶段」的局部注释。保留公开接口 TSDoc、`skipSelf: true` 的递归约束，以及使用 `this.resolve` 保留 Vite 能力的说明。

- [ ] **步骤 2：补充 README 配置说明**

```md
createRealpathFallbackPlugin({
  include: ["classnames", "es-toolkit"],
  exclude: ["vue"],
  debug: true,
  detailedLog: true,
})
```

说明：`debug` 输出初始化信息和配置警告；`detailedLog` 输出每个受理请求的最终结果，成功使用 `info`，失败使用 `warn`，两者可独立开启。

- [ ] **步骤 3：运行格式检查**

运行：

```bash
pnpm exec prettier --check plugins/vite-plugin-realpath-fallback/src/realpath-fallback-plugin.ts plugins/vite-plugin-realpath-fallback/src/__tests__/realpath-fallback-plugin.test.ts plugins/vite-plugin-realpath-fallback/README.md
```

预期：所有文件通过 Prettier 检查；若失败，运行同一路径的 `prettier --write` 后重新检查。

- [ ] **步骤 4：提交文档与清理**

```bash
git add plugins/vite-plugin-realpath-fallback/src/realpath-fallback-plugin.ts plugins/vite-plugin-realpath-fallback/README.md
git commit --only plugins/vite-plugin-realpath-fallback/src/realpath-fallback-plugin.ts plugins/vite-plugin-realpath-fallback/README.md -m "refactor(plugin): 精简 realpath fallback 实现"
```

### 任务 4：完整验证

**文件：**
- 验证：`plugins/vite-plugin-realpath-fallback`

- [ ] **步骤 1：运行单元测试**

```bash
pnpm --dir plugins/vite-plugin-realpath-fallback test
```

预期：全部测试通过。

- [ ] **步骤 2：运行类型检查**

```bash
pnpm --dir plugins/vite-plugin-realpath-fallback type-check
```

预期：退出码为 0，无 TypeScript 错误。

- [ ] **步骤 3：运行构建**

```bash
pnpm --dir plugins/vite-plugin-realpath-fallback build
```

预期：退出码为 0，生成 ESM、CJS 和类型声明产物。

- [ ] **步骤 4：检查目标文件差异**

```bash
git diff --check -- plugins/vite-plugin-realpath-fallback
git status --short -- plugins/vite-plugin-realpath-fallback
```

预期：没有空白错误；状态只包含本次计划内的目标文件或已按任务提交。
