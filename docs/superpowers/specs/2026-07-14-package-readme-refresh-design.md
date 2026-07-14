# Core、Vue 与 Vant README 校准设计

## 背景

`@schemx/core`、`@schemx/vue` 和 `@schemx/vant` 已完成运行时、上下文和样式入口调整，现有 README 中仍有部分旧实现名称、职责描述和不再需要的用户配置。文档需要以当前公开入口、类型定义和构建行为为准重新校准。

## 目标

- 修正三个 README 中已过期或容易误解的信息；
- 保留现有文档结构和有效示例，避免无关重写；
- 删除 Vant 用户侧的 `vite-plugin-package-resolution-compat` 安装与配置说明；
- 明确 ESM 样式自动加载边界以及 Vue 上下文 API 的职责；
- 确保示例与当前公开类型和方法名称一致。

## 修改范围

### `@schemx/core`

- 将旧运行时流程名称更新为当前的 `createCompile().toDescriptors()`、`createReconcilePlan()`、`commitReconcilePlan()`、`RuntimeNodeManager`、`RuntimeViewState` 和 `ViewSchemas`；
- 校准模块边界与公开 API 速查；
- 复核动态依赖、动态子树、校验、监听和 ViewSchemas 示例；
- 不将内部模块误写为公开 API。

### `@schemx/vue`

- 明确 `useForm()` 只负责实例创建和生命周期释放，不自动注册 Vue provide/inject 上下文；
- 补充 `createFormContext()`、`useFormContext()`、`createFieldContext()`、`createFormConfigContext()` 和 `useViewSchemas()`；
- 将 `useFormConfigContext()` 的说明修正为表单级展示配置上下文；
- 保留 ESM 自动加载 `@schemx/vue/style.css` 的说明。

### `@schemx/vant`

- 删除整个 uni-app 兼容插件章节，不再要求用户安装或配置任何 Schemx Vite 解析插件；
- 保留包自身构建阶段的 `injectStyleCss()`，确保 ESM 入口继续自动加载自身样式；
- 明确 `vant/lib/index.css` 仅用于 Vant 组件库样式，可由业务已有的自动按需方案替代；
- 复核 Renderer 列表和表单实例方法。

## 非目标

- 不修改三个包的公开 API、运行时逻辑或依赖声明；
- 不移除 `packages/vant/vite.plugins.ts` 中的 `injectStyleCss()`；
- 不重写 README 的整体信息架构；
- 不修改插件自身文档或示例项目文档。

## 验证

- 使用 Prettier 检查三个 README；
- 搜索并确认 Core README 不再出现旧运行时名称；
- 搜索并确认 Vant README 不再出现 `vite-plugin-package-resolution-compat`；
- 对照 `src/index.ts`、公开类型和 `package.json` exports 复核 API 与样式说明；
- 运行三个包的类型检查，确保文档修改没有伴随意外代码变更。

## 验收标准

- 三个 README 只描述当前可用的公开能力；
- Vue 上下文 API 的创建、提供和读取职责清晰且准确；
- Vant 用户不再被要求配置 Schemx Vite 插件；
- ESM 与 CommonJS 的样式加载边界描述准确；
- 当前暂存区中的既有用户改动得到保留。
