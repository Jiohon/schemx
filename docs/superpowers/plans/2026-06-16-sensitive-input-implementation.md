# sensitive-input 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 在当前会话中逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 `@schemx/vant` 中新增展示优先的 `sensitiveInput` 渲染器，默认脱敏展示，点击后显示完整值并在普通态进入输入框。

**架构：** 新增 `components/SensitiveInput` 作为纯组件，复用 `SchemxCell` 和 `SchemxInput`。新增 `renderers/SensitiveInputRenderer` 作为 schema renderer 包装层，并在默认 renderer 和类型映射中注册 `sensitiveInput`。

**技术栈：** Vue 3 `<script setup>`、Vitest、@vue/test-utils、Vant Icon、现有 `@schemx/vant` 组件体系。

---

## 文件职责

- 创建 `packages/vant/src/components/SensitiveInput/types.ts`：定义 `SensitiveInputProps`、`SensitiveMaskFormatter`、默认脱敏函数。
- 创建 `packages/vant/src/components/SensitiveInput/index.vue`：实现展示态/展开态切换、受控 `revealed`、只读/禁用逻辑。
- 创建 `packages/vant/src/components/SensitiveInput/index.ts`：导出组件和类型。
- 创建 `packages/vant/src/components/SensitiveInput/__tests__/SensitiveInput.test.ts`：覆盖组件核心行为。
- 创建 `packages/vant/src/renderers/SensitiveInputRenderer/types.ts`：定义 renderer props。
- 创建 `packages/vant/src/renderers/SensitiveInputRenderer/index.vue`：连接 renderer props 和 `SensitiveInput`。
- 创建 `packages/vant/src/renderers/SensitiveInputRenderer/index.ts`：导出 renderer 和类型。
- 创建 `packages/vant/src/renderers/SensitiveInputRenderer/__tests__/SensitiveInputRenderer.test.ts`：覆盖 renderer 的 v-model 和只读行为。
- 修改 `packages/vant/src/renderers/index.ts`：导出 renderer 和类型，并把 `sensitiveInput` 加入默认类型列表。
- 修改 `packages/vant/src/renderers/defaultRenderers.ts`：注册 `sensitiveInput`。
- 修改 `packages/vant/src/types/schemx.ts`：声明 `sensitiveInput` 的 props 类型。

## 任务 1：组件红灯测试

**文件：**
- 创建：`packages/vant/src/components/SensitiveInput/__tests__/SensitiveInput.test.ts`

- [ ] **步骤 1：编写失败测试**

覆盖：
- 默认展示 `maskFormatter` 返回值。
- 点击显示后出现完整值输入框。
- 输入后 `onChange` 回传真实值。
- `readonly + revealWhenReadonly=true` 只展示完整值，不渲染输入框。
- `disabled` 时不能 reveal。

- [ ] **步骤 2：运行红灯验证**

运行：

```bash
pnpm --filter @schemx/vant test -- SensitiveInput.test.ts
```

预期：FAIL，原因是 `../index.vue` 模块不存在。

## 任务 2：实现 SensitiveInput 组件

**文件：**
- 创建：`packages/vant/src/components/SensitiveInput/types.ts`
- 创建：`packages/vant/src/components/SensitiveInput/index.vue`
- 创建：`packages/vant/src/components/SensitiveInput/index.ts`

- [ ] **步骤 1：实现最小组件**

实现：
- `defaultMaskFormatter`
- `maskFormatter` 与 `formatter` 分离
- 内部/受控 `revealed`
- `disabled`、`readonly`、`revealWhenReadonly`
- `focusOnReveal`、`hideOnBlur`

- [ ] **步骤 2：运行组件绿灯验证**

运行：

```bash
pnpm --filter @schemx/vant test -- SensitiveInput.test.ts
```

预期：PASS。

## 任务 3：renderer 红灯测试

**文件：**
- 创建：`packages/vant/src/renderers/SensitiveInputRenderer/__tests__/SensitiveInputRenderer.test.ts`

- [ ] **步骤 1：编写失败测试**

覆盖：
- renderer 默认传入 `value` 并显示脱敏值。
- 展开后输入新值触发 `onChange`。
- 只读场景按 `revealWhenReadonly` 显示完整值。

- [ ] **步骤 2：运行红灯验证**

运行：

```bash
pnpm --filter @schemx/vant test -- SensitiveInputRenderer.test.ts
```

预期：FAIL，原因是 renderer 模块不存在。

## 任务 4：实现 renderer 和注册

**文件：**
- 创建：`packages/vant/src/renderers/SensitiveInputRenderer/types.ts`
- 创建：`packages/vant/src/renderers/SensitiveInputRenderer/index.vue`
- 创建：`packages/vant/src/renderers/SensitiveInputRenderer/index.ts`
- 修改：`packages/vant/src/renderers/index.ts`
- 修改：`packages/vant/src/renderers/defaultRenderers.ts`
- 修改：`packages/vant/src/types/schemx.ts`

- [ ] **步骤 1：实现 renderer 包装层**

`SensitiveInputRenderer` 只负责接收 renderer props，使用 `defineModel("value")` 连接 `SensitiveInput`。

- [ ] **步骤 2：注册导出和类型映射**

追加导出 `SensitiveInputRenderer`、`SensitiveInputRendererProps`、`SensitiveInputValue`，并注册 `sensitiveInput`。

- [ ] **步骤 3：运行 renderer 绿灯验证**

运行：

```bash
pnpm --filter @schemx/vant test -- SensitiveInputRenderer.test.ts
```

预期：PASS。

## 任务 5：整体验证

**文件：**
- 修改：本计划涉及的所有文件

- [ ] **步骤 1：运行相关测试**

运行：

```bash
pnpm --filter @schemx/vant test -- SensitiveInput.test.ts SensitiveInputRenderer.test.ts
```

预期：PASS。

- [ ] **步骤 2：运行类型检查**

运行：

```bash
pnpm --filter @schemx/vant exec vue-tsc -p tsconfig.json --noEmit
```

预期：exit 0。

- [ ] **步骤 3：提交实现**

只提交本功能文件和计划文件，不提交既有无关工作区改动。

```bash
git add -f docs/superpowers/plans/2026-06-16-sensitive-input-implementation.md
git add packages/vant/src/components/SensitiveInput packages/vant/src/renderers/SensitiveInputRenderer packages/vant/src/renderers/index.ts packages/vant/src/renderers/defaultRenderers.ts packages/vant/src/types/schemx.ts
git commit -m "feat(vant): 添加 sensitive-input 脱敏输入组件"
```
