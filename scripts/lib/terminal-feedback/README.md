# 通用终端反馈

本目录是新终端反馈实现的最小内核，暂不替换现有脚本。

- `ui.mjs`：静态反馈、Prompt 与输出流约定。
- `session.mjs`：命令生命周期与任务边界。
- `process.mjs`：原样透传子进程日志。
- `bridge.mjs` 与 `cli.mjs`：Bash 可调用的无状态反馈入口，例如 `node scripts/lib/terminal-feedback/cli.mjs success "已完成"`。

外部构建、测试、检查和发布命令统一使用 `runProcess()`；它通过 `stdio: "inherit"` 保留原生命令日志。动态 Spinner、紧凑日志和并发日志编排不属于首版范围。
