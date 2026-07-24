# 脚本终端反馈

所有面向用户的业务脚本必须从 `scripts/lib/terminal-feedback/index.mjs` 导入 `createTerminalSession`，不得直接使用 `console.log`、`process.stderr.write`、低层渲染方法或自行创建颜色实例。机器可读 CLI 结果可以写入 stdout；用户反馈统一写入 stderr。

```js
import { createTerminalSession } from "./lib/terminal-feedback/index.mjs"

const session = createTerminalSession()
session.begin({ title: "Schemx" })
session.section({ title: "检查配置", details: { 目标: ["@schemx/core", "@schemx/vue"] } })
await session.run({
  command: "pnpm",
  args: ["lint"],
  label: "运行 lint",
})
session.finish()
```

会话包含 `begin`、`section`、`context`、`notice`、`run` 与 `finish`。`run()` 默认通过 `stdio: "inherit"` 完整透传外部命令日志，并将 Ctrl+C / `SIGTERM` 转发给子进程；中断退出码分别为 `130` / `143`。仅 `pnpm pack --json`、元数据探测等需要机器读取输出的场景传入 `quiet: true`，其 stdout/stderr 会以 1 MiB 尾部上限返回，并提供截断标记。Bash 脚本使用 `scripts/terminal.mjs` 调用同一内核。
