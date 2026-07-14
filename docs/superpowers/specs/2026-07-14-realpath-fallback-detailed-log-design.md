# realpath fallback 详细日志与代码精简设计

## 背景

`@schemx/vite-plugin-realpath-fallback` 在标准 Vite 解析失败后，会把 importer 转换为真实文件系统路径并再次解析。当前插件同时维护 `debug`、`debugStandardResolve` 和构建结束统计，但存在以下问题：

- `debugStandardResolve` 只能补充标准解析成功日志，无法完整描述每次解析的最终结果；
- 统计信息没有覆盖 importer 无效、realpath 获取失败和真实路径未变化等终止分支；
- 普通日志、警告日志和各分支字段拼装存在重复逻辑；
- 大量局部注释重复了代码本身表达的流程，增加维护成本。

## 目标

- 新增公开配置项 `detailedLog?: boolean`；
- 开启 `detailedLog` 后，每个通过 source 和 importer 过滤的解析请求都输出一次最终结果；
- 成功和失败结果均包含足够定位问题的上下文字段；
- 删除与详细日志重叠或不能准确表达行为的逻辑；
- 保留现有解析顺序、过滤规则、realpath 缓存和 Vite 解析元数据。

## 非目标

- 不改变 `include`、`exclude`、`includeImporters`、`excludeImporters` 的过滤语义；
- 不为被过滤或缺少 importer 的请求输出详细日志；
- 不引入结构化日志回调或自定义 logger；
- 不改变标准解析和 fallback 解析的返回值。

## 公开配置

`RealpathFallbackPluginOptions` 新增：

```ts
/**
 * 是否输出每次受理解析请求的详细结果。
 *
 * 成功与失败结果都会输出。
 *
 * @default false
 */
detailedLog?: boolean
```

`detailedLog` 独立于 `debug` 生效。`debug` 继续负责插件初始化信息和配置警告；`detailedLog` 专门负责逐请求结果，避免调用方必须同时配置两个开关。

移除 `debugStandardResolve`。该字段尚未发布，且其能力被 `detailedLog` 完整覆盖。

## 解析结果与日志

每个通过过滤的请求最多输出一条详细结果日志：

| `status` | 级别 | 含义 | 关键字段 |
| --- | --- | --- | --- |
| `standard-resolved` | `info` | 原始 importer 解析成功 | `source`、`importer`、`resolved` |
| `fallback-resolved` | `info` | 真实 importer 重试成功 | `source`、`importer`、`realImporter`、`resolved` |
| `invalid-importer` | `warn` | importer 无法转换为绝对文件路径 | `source`、`importer` |
| `realpath-failed` | `warn` | 无法获取 importer 真实路径 | `source`、`importer`、`importerPath` |
| `realpath-unchanged` | `warn` | 真实路径与逻辑路径相同，无需重试 | `source`、`importer`、`realImporter` |
| `fallback-failed` | `warn` | 真实 importer 重试仍未解析 | `source`、`importer`、`realImporter` |

日志标题统一为 `[realpath-fallback] resolve completed`，通过 `status` 区分结果。成功使用 `logger.info`，失败或无法继续 fallback 的结果使用 `logger.warn`。

## 代码精简

- 删除 `ResolveStatistics`、统计累加和 `buildEnd` 汇总；
- 删除 `debugStandardResolve`；
- 将 `debugInfo` 与 `debugWarn` 合并为单个详细结果输出函数；
- 保留 `formatDebugMessage` 作为统一字段格式化入口；
- 删除仅复述执行步骤的局部块注释，保留公开 API、关键 `skipSelf` 约束和兼容性说明；
- `buildEnd` 只为清理缓存而存在时予以保留，确保长期运行或重新构建后不残留缓存。

## 测试策略

采用 TDD 补充以下行为测试：

1. `detailedLog: true` 时，标准解析成功输出 `standard-resolved`；
2. fallback 成功输出 `fallback-resolved` 及真实 importer、解析结果；
3. fallback 失败输出 `fallback-failed`；
4. 真实路径未变化时输出 `realpath-unchanged`；
5. `detailedLog` 在 `debug` 未开启时仍然输出；
6. `detailedLog` 未开启时不输出逐请求结果；
7. 现有 fallback 成功行为保持不变。

测试通过模拟 Vite `ResolvedConfig.logger` 捕获日志，同时继续使用临时目录和真实符号链接验证 realpath 行为。

## 验收标准

- `RealpathFallbackPluginOptions` 暴露 `detailedLog?: boolean`；
- 开启后，每个通过过滤的请求都恰好输出一次成功或失败结果；
- 日志包含 `status` 及当前结果可获得的路径字段；
- `debugStandardResolve`、不完整统计和重复日志函数已删除；
- README 说明 `debug` 与 `detailedLog` 的区别并给出示例；
- 插件单元测试、类型检查和构建全部通过。
