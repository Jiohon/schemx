# Core、Vue 与 Vant README 校准实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让 `@schemx/core`、`@schemx/vue` 和 `@schemx/vant` README 与当前公开 API、运行时结构和样式加载行为保持一致。

**架构：** 仅修改三个包的 README，不改变运行时代码或构建配置。每份文档以对应 `src/index.ts`、公开类型和 `package.json` exports 为事实来源，并通过文本断言与 Prettier 验证关键描述。

**技术栈：** Markdown、TypeScript 公开类型、Prettier、ripgrep

---

## 文件结构

- 修改 `packages/core/README.md`：更新运行时流程、模块边界和公开 API 说明。
- 修改 `packages/vue/README.md`：校准 Vue 生命周期与 provide/inject 上下文职责。
- 修改 `packages/vant/README.md`：删除用户侧解析插件配置并校准样式说明。

### 任务 1：校准 Core README

**文件：**
- 修改：`packages/core/README.md`

- [ ] 将运行时流程更新为：

```text
raw schemas
  -> createCompile().toDescriptors()
  -> createReconcilePlan()
  -> commitReconcilePlan()
  -> RuntimeNodeManager
  -> RuntimeViewState
  -> ViewSchemas
```

- [ ] 将模块边界中的 `viewGraph` 描述改为 `RuntimeViewState`，并确保目录列表与 `packages/core/src` 一致。

- [ ] 对照 `packages/core/src/types/form.ts` 复核 `SchemxInstance` 表格，保留当前存在的值、快照、校验、重置、schema、view、renderer 和 validator 方法。

- [ ] 运行旧名称断言：

```bash
rg -n "compileToDescriptors|viewGraph" packages/core/README.md
```

预期：无匹配。

### 任务 2：校准 Vue README

**文件：**
- 修改：`packages/vue/README.md`

- [ ] 将 `useForm()` 说明改为创建表单实例、合并默认注册表并在 Vue effect scope 销毁时释放实例，明确它不自动调用 `provide()`。

- [ ] 在 Composition API 表格补充以下准确映射：

```text
createFormContext()       提供表单实例上下文
useFormContext()          获取表单实例上下文
createFieldContext()      提供当前字段实例上下文
useFieldContext()         获取当前字段实例上下文
createFormConfigContext() 提供表单级展示配置
useFormConfigContext()    获取表单级展示配置
useViewSchemas()          将 ViewSchemas 订阅桥接为 shallowRef
```

- [ ] 保留 ESM 自动加载基础样式和 CommonJS 手动引入的边界说明。

- [ ] 运行上下文断言：

```bash
rg -n "createFormContext|useFormContext|createFormConfigContext|useViewSchemas" packages/vue/README.md
```

预期：4 个 API 均有匹配。

### 任务 3：校准 Vant README

**文件：**
- 修改：`packages/vant/README.md`

- [ ] 删除从 `### uni-app 兼容配置` 到 `## 快速开始` 之前的完整章节。

- [ ] 在安装说明后明确：使用 `@schemx/vant` 不需要配置 Schemx Vite 插件。

- [ ] 保留以下样式边界：ESM 自动加载 `@schemx/vant` 和 `@schemx/vue` 样式；CommonJS 需要显式引入；`vant/lib/index.css` 可由业务已有的 Vant 自动按需样式方案替代。

- [ ] 对照 `packages/vant/src/renderers/index.ts` 和 `packages/core/src/types/form.ts` 复核 Renderer 列表与表单实例方法。

- [ ] 运行插件说明断言：

```bash
rg -n "vite-plugin-package-resolution-compat|createPackageResolutionCompatPlugin" packages/vant/README.md
```

预期：无匹配。

### 任务 4：完整验证并更新暂存区

**文件：**
- 验证：`packages/core/README.md`
- 验证：`packages/vue/README.md`
- 验证：`packages/vant/README.md`

- [ ] 运行格式检查：

```bash
pnpm exec prettier --check packages/core/README.md packages/vue/README.md packages/vant/README.md
```

预期：三个 README 均通过。

- [ ] 运行三个包类型检查：

```bash
pnpm --dir packages/core type-check
pnpm --dir packages/vue type-check
pnpm --dir packages/vant type-check
```

预期：全部退出码为 0。

- [ ] 检查差异和空白错误：

```bash
git diff --check -- packages/core/README.md packages/vue/README.md packages/vant/README.md
git diff --cached --check -- packages/core/README.md packages/vue/README.md packages/vant/README.md
```

预期：无输出。

- [ ] 将三个 README 的最终版本更新到现有暂存区，不创建提交：

```bash
git add packages/core/README.md packages/vue/README.md packages/vant/README.md
```
