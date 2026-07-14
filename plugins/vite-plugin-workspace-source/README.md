# @schemx/vite-plugin-workspace-source

用于 Vite workspace 本地源码开发模式。插件将配置的包名直接解析到
`packages/*/src/index.ts`，并根据 importer 所在的源码包动态解析 `@/`。

## 用法

```ts
import { resolve } from "node:path"

import { createWorkspaceSourcePlugin } from "@schemx/vite-plugin-workspace-source"

const workspaceRoot = resolve(__dirname, "../..")

export default {
  plugins: [
    createWorkspaceSourcePlugin({
      appRoot: resolve(__dirname, "src"),
      workspaceRoot,
      packageRoots: {
        "@schemx/core": resolve(workspaceRoot, "packages/core/src"),
        "@schemx/vue": resolve(workspaceRoot, "packages/vue/src"),
        "@schemx/vant": resolve(workspaceRoot, "packages/vant/src"),
      },
    }),
  ],
}
```

插件同时组合 Vue JSX 转换、配置 workspace 文件访问范围，并关闭 symlink 路径保留，避免源码模式下加载重复的 Vue 实例。
