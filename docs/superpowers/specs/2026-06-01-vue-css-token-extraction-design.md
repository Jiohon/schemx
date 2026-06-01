# Vue 层 CSS Token 抽离设计

## 目标

整理 `@schemx/vue` 的 CSS 自定义属性，使 Vue 层保持 UI 框架无关，并将组件样式中的布局常量集中到 `--schemx-*` token。

## 范围

本轮只修改 Vue 层样式：

- `packages/vue/src/styles/variables.css`
- `packages/vue/src/styles/index.css`
- `packages/vue/src/components/FormItem/index.css`
- `packages/vue/src/components/FormGroup/index.css`

本轮不修改 `@schemx/vant` 的 SCSS，不引入 `--van-*` token，不处理 renderer 样式命名问题。

## Token 分层

Vue 层只声明和消费 `--schemx-*` token。默认值直接写在 `variables.css` 中，不依赖具体 UI 框架。

保留两类 token：

1. 基础 token：颜色、字号、间距、圆角。
2. Vue 组件语义 token：表单容器、表单项、分组标题和分组箭头。

移除 Vue 层中未被 Vue 组件使用、且属于具体 renderer 的 token：

- `--schemx-icon-size`
- `--schemx-icon-color`
- `--schemx-clear-icon-color`
- `--schemx-rate-star-size`
- `--schemx-rate-star-color`
- `--schemx-rate-star-active-color`
- `--schemx-selector-gap`
- `--schemx-selector-option-min-width`
- `--schemx-selector-option-padding`

## 新增语义 Token

将 Vue 层组件中散落的布局常量抽离为以下变量：

```css
--schemx-form-padding-bottom: 15px;
--schemx-schemas-padding-inline: 6px;
--schemx-item-label-top-gap: 4px;
--schemx-item-content-padding-inline: 6px;
--schemx-item-required-gap: 2px;
--schemx-item-error-gap: 2px;
--schemx-group-arrow-size: 5px;
--schemx-group-arrow-duration: 0.2s;
```

保留 CSS 固有值，如 `0`、`1px` 分隔线宽度、`0.5` 缩放比例和布局关键字。这些值不需要主题配置。

## 使用约束

- Vue 组件 CSS 不直接引用 `--van-*`。
- 组件中需要主题覆盖的视觉与布局值应通过 `--schemx-*` 引用。
- 避免为只使用一次且没有主题意义的 CSS 固有值创建 token。
- Vant 适配层后续可以独立决定是否映射到 `--van-*` fallback。

## 验证

实现后执行：

```bash
pnpm type-check
pnpm --filter @schemx/vue lint
git diff --check
```

并使用 `rg` 确认 Vue 层组件样式中不再散落本轮约定抽离的像素常量。
