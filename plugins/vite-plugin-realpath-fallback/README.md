# @schemx/vite-plugin-realpath-fallback

通用的 Vite importer realpath 重试插件。它不包含 Schemx、Vue 或 uni-app 的业务默认配置。

解析裸包导入时，插件先使用原始 importer 调用 Vite 标准解析；标准解析失败后，再把 importer 转换为真实文件系统路径并重试。

## 用法

```ts
import { createRealpathFallbackPlugin } from "@schemx/vite-plugin-realpath-fallback"

export default {
  plugins: [
    createRealpathFallbackPlugin({
      include: ["classnames", "es-toolkit"],
      exclude: ["vue"],
      debug: true,
      detailedLog: true,
    }),
  ],
}
```

`debug` 输出初始化信息和配置警告。`detailedLog` 输出每个受理解析请求的最终结果：成功结果使用 `info`，失败结果使用 `warn`。两个选项可以独立开启。

详细日志包含统一的 `status` 字段：

- `standard-resolved`：使用原始 importer 解析成功；
- `fallback-resolved`：使用真实 importer 解析成功；
- `invalid-importer`：importer 不是可用的文件路径；
- `realpath-failed`：无法读取 importer 的真实路径；
- `realpath-unchanged`：真实路径没有变化，无需重试；
- `fallback-failed`：使用真实 importer 仍然解析失败。

该插件只参与普通 Vite `resolveId` 管线，不会修改 `optimizeDeps`、`resolve` 或开发服务器配置。
