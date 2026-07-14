# @schemx/vite-plugin-package-resolution-compat

用于普通 npm、pnpm 包安装模式下的完整 Vite 依赖解析兼容。插件会跳过目标包的依赖预构建，并组合 `@schemx/vite-plugin-realpath-fallback` 在普通解析阶段重试依赖解析。

## 用法

```ts
import { createPackageResolutionCompatPlugin } from "@schemx/vite-plugin-package-resolution-compat"

export default {
  plugins: [
    createPackageResolutionCompatPlugin({
      packages: ["@schemx/core", "@schemx/vue", "@schemx/vant"],
      fallbackDependencies: [
        "@preact/signals-core",
        "es-toolkit",
        "csstype",
        "classnames",
        "dayjs",
        "@vant/use",
        "vant",
      ],
    }),
  ],
}
```

该插件会完成以下配置：

- 将 `packages` 加入 `optimizeDeps.exclude`。
- 开启 `resolve.preserveSymlinks`。
- 对 Vue 运行时包配置 `resolve.dedupe`。
- 使用 importer realpath 重试 `fallbackDependencies`。
