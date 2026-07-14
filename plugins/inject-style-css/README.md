# @plugins/inject-style-css

仓库内部使用的 Vite 构建插件，用于让库的 ESM 入口自动加载构建产物中的 CSS。

## 工作方式

Vite library mode 会把组件样式提取为独立 CSS asset。`injectStyleCss` 在 `generateBundle` 阶段找到该 asset，并向每个 `.mjs` 入口写入相对路径 CSS import。

插件只处理 ESM 入口，不修改 CommonJS 产物；没有找到目标 CSS asset 或入口已经包含相同 import 时，不会修改产物。

## 使用方式

```ts
import { injectStyleCss } from "@plugins/inject-style-css"

export default {
  plugins: [injectStyleCss()],
}
```

CSS 产物不是 `style.css` 时，可以传入文件名：

```ts
injectStyleCss({ styleFileName: "components.css" })
```

## 目录结构

```text
inject-style-css/
├── src/
│   ├── __tests__/
│   │   └── index.test.ts
│   └── index.ts
├── package.json
├── README.md
├── tsconfig.json
└── vitest.config.ts
```

## 验证

```bash
pnpm --filter @plugins/inject-style-css test
pnpm --filter @plugins/inject-style-css type-check
```
