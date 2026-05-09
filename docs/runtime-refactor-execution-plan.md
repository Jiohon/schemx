# Schemx Runtime Refactor Execution Plan (Stage A-E)

## 1. Summary

本文件是 Schemx Runtime 重构的唯一实施基线。

- 架构原理说明：`schemx_runtime_architecture_plan_v2.md`
- 实施拆解与交付标准：本文档

本次为彻底重构，不以最小改动为目标；但每个阶段必须满足：

1. 可独立验收
2. 可独立回退
3. 不破坏 `createForm` 外部调用契约

---

## 2. Global Constraints

- Raw Schema immutable，Runtime mutable
- dependency 作为 runtime container，不直接改写 root schema
- scheduler 仅采用 microtask batching
- dependency async 统一使用 versioning 防竞态
- core 保持 framework-agnostic，Vue 作为首个适配层

---

## 3. Stage Plan

### Stage A Runtime Core

**状态**

- Done：runtime core 已建立并接入 `createForm`
- Done：dependency 执行已切换为 runtime tree + scheduler + versioning
- Done：已补充 runtime integration tests
- Verified：`pnpm exec tsc --noEmit --pretty false`
- Verified：`pnpm --filter @schemx/core test`

**输入**

- 当前 `createForm` + `schemas` 主链路
- `compileSchema-plan.ts` 原型机制（runtime node / scheduler / subtree）

**改造点**

1. 在 core 建立 runtime 子系统（建议目录：`packages/core/src/runtime`）：
   - `types`: `RuntimeNode` / `FieldRuntime` / `DependencyRuntimeNode`
   - `scheduler`: dirty queue + microtask flush
   - `compiler`: normalize / static validate / runtime build
   - `dependency runner`: watch -> schedule -> run renderer -> compile subtree -> mount subtree
2. `createForm` 内部新增 `runtimeRoot` 与 runtime context，外部 API 不变。
3. dependency 默认启用 versioning，拒绝旧 promise 回写。

**测试要求**

1. dependency 快速切换竞态：后触发结果覆盖先触发结果。
2. 初始化与更新流程可正确构建 runtime tree。
3. destroy 后 dependency watcher 可释放。

**验收标准**

- 业务方无需改调用方式即可跑通基础表单和 dependency。
- 高频输入下 flush 次数小于变更次数（至少可观测到批处理）。

**退出条件**

- 已有链路由 runtime 主导执行；旧 slot/flatten 仍可并存作为临时兼容。

---

### Stage B Identity & Lifecycle

**状态**

- Done：field runtime 增加 mount/unmount 生命周期
- Done：dependency subtree 卸载时清理字段 rules/errors
- Done：同 key field node 复用时避免重复注册 schema rules
- Done：runtime field 生命周期已接入 `createForm`
- Verified：`pnpm --filter @schemx/core exec tsc --noEmit --pretty false`
- Verified：`pnpm --filter @schemx/core test`

**输入**

- Stage A runtime tree
- 当前 validator/rules 生命周期逻辑

**改造点**

1. Key 策略固定：`ownerPath + localIdentity(name|key|stableIndexFallback)`。
2. 实现 subtree diff 三态：reuse / update / dispose。
3. 字段生命周期与校验生命周期绑定：
   - mount：注册规则、建立字段订阅
   - unmount：清理规则状态、错误状态、字段订阅
4. 明确 nested dependency owner 继承规则，避免跨层级重名冲突。

**测试要求**

1. 字段顺序变化时 identity 稳定，不出现无意义 remount。
2. 字段删除后无残留 errors、subscriptions、rule registrations。
3. nested dependency 至少三层可稳定更新与卸载。

**验收标准**

- subtree 局部变化仅影响局部节点。
- 同名字段在不同 ownerPath 下互不污染。

**退出条件**

- runtime diff 与生命周期闭环稳定，支持下一阶段删除旧模型。

---

### Stage C Remove Legacy Pipeline

**状态**

- Done：旧 `resolveSchemas` slot pipeline 已删除
- Done：`flattenSchemas` / `resolveDependencies` / `SchemaSlot` 已从 core 入口导出移除
- Done：`getResolvedSchemas()` 由 `RuntimeEngine` 从 runtime tree 派生，`getSchemas()` 保留为兼容别名
- Done：代码搜索确认运行时无 `schemaSlots` / `pendingTracker` / slot index 路径
- Verified：`pnpm --filter @schemx/core test`
- Verified：`pnpm --filter @schemx/core exec tsc --noEmit --pretty false`
- Verified：`pnpm exec tsc --noEmit --pretty false`

**输入**

- Stage B 稳定 runtime 主链路

**改造点**

1. 从主流程移除旧 dependency 机制：
   - `schemaSlots`
   - `flattenSchemas`
   - `resolveDependencies` 旧路径
2. `getResolvedSchemas()` 改为 runtime tree 派生：
   - 若 UI 仍需要 schema 视图，提供 runtime adapter flatten（兼容层）
3. 旧依赖模型类型与导出标记 deprecated，并在阶段末删除。
4. 验证运行时不再依赖 slot index。

**测试要求**

1. 回归所有 dependency 场景不触发旧链路。
2. 无 slot index 依赖仍可完成 nested dependency 渲染。

**验收标准**

- runtime 成为唯一执行路径。
- 旧链路代码不再被调用（包含间接调用）。

**退出条件**

- 完成“无旧模型路径”目标，进入适配层重写。

---

### Stage D Vue Adapter Rewrite

**状态**

- Done：core 已新增 `getResolvedSchemas()`，dependency 在 schema projection 中会被 subtree 替换
- Done：`SchemxForm` 已通过 `useResolvedSchemas()` 消费 resolved schema projection，并通过 `form.effect` 桥接 runtime signal 到 Vue ref
- Done：`FormItem` / `FormGroup` / `FormDependency` 保留 `node` 输入兼容能力，主表单链路使用 resolved schema list
- Done：`FormDependency` 主链路不再负责 dependency 计算，仅保留 schema 入口的兼容 fallback
- Done：补齐 `resolvePropertyCondition`、`useField(name)`、`createFormInstance`、`FORM_INSTANCE_KEY` 与公开 registry 方法的兼容层
- Verified：`pnpm --filter @schemx/core exec tsc --noEmit --pretty false`
- Verified：`pnpm --filter @schemx/vue exec tsc --noEmit --pretty false`
- Verified：`pnpm --filter @schemx/core test`
- Verified：`pnpm --filter @schemx/vue test`
- Verified：`pnpm exec tsc --noEmit --pretty false`

**输入**

- Stage C runtime-only core
- 当前 Vue 组件树（`FormItem` / `FormDependency` / `FormGroup`）

**改造点**

1. Vue 渲染输入从 raw schema list 切换到 resolved schema projection。
2. dependency 在 resolved schema projection 中由 renderer subtree 替换。
3. `useDependency` 下沉或瘦身为展示工具，依赖计算权回收至 core。
4. 保持外部 `schemas` 入参不变，兼容已有业务使用方式。
5. 对齐动态 `visible/disabled/readonly` 行为。

**测试要求**

1. 旧业务 schema 运行行为与渲染结果对齐。
2. slot 与自定义 renderer 在 dependency/nested 场景下可工作。
3. 快速切换 dependency 不闪烁、不丢失稳定字段状态。

**验收标准**

- Vue 层不再自行执行 dependency 计算。
- runtime node 到 UI 的映射稳定。

**退出条件**

- Vue 适配层完成迁移，核心职责边界清晰（core 计算，vue 渲染）。

---

### Stage E Hardening & Release

**状态**

- Done：补充 runtime hardening tests，覆盖 async submit 等待、microtask batching、adapter runtime root
- Done：移除 Vue runtime bridge 调试日志
- Done：新增迁移说明 `docs/runtime-refactor-migration-guide.md`
- Done：更新 `.gitignore`，允许提交 runtime refactor 执行计划与迁移说明
- Verified：`pnpm --filter @schemx/core test`
- Verified：`pnpm --filter @schemx/vue test`
- Verified：`pnpm --filter @schemx/core exec tsc --noEmit --pretty false`
- Verified：`pnpm --filter @schemx/vue exec tsc --noEmit --pretty false`
- Verified：`pnpm exec tsc --noEmit --pretty false`

**输入**

- Stage D 全链路完成版本

**改造点**

1. 完成回归矩阵：
   - 异步竞态
   - 嵌套依赖
   - 快速切换
   - 卸载清理
   - 校验一致性
   - 性能基线
2. 输出迁移说明：
   - 行为差异
   - 废弃 API
   - 性能变化
   - 常见排障
3. 发布策略：`next/beta` -> 灰度 -> stable。

**测试要求**

1. 核心 correctness、lifecycle、compat、performance 四类测试全部通过。
2. 真实业务样例回归通过后再进入 stable。

**验收标准**

- 满足发布门槛，具备可运维说明与回滚策略。

**退出条件**

- 稳定发布完成，旧模型彻底退役。

---

## 4. Cross-Stage Test Matrix

### Core Correctness

1. dependency A/B 竞态：旧 promise 不得回写。
2. nested dependency（>=3 层）挂载/更新/卸载正确。
3. subtree diff 在局部增删和重排时保持 identity 稳定。

### Lifecycle Consistency

1. 字段卸载后无残留 watcher/rules/errors。
2. form destroy 后 dependency watcher 全部释放。

### Compatibility

1. `createForm`、`getFieldValue/setFieldValue/submit` 外部行为不变。
2. Vue 动态属性行为与现网一致。

### Performance

1. 高频输入下调度批处理有效。
2. 无明显长任务回退；依赖切换抖动可控。

---

## 5. Delivery and Rollback Rules

1. 每个 Stage 必须独立 PR 与独立验收记录。
2. 未达到退出条件不得进入下一 Stage。
3. 每个 Stage 保留单独回滚点：
   - 失败时仅回滚当前 Stage，不联动回滚前序已验收 Stage。
4. Stage C 之前必须保留旧链路分支快照，避免中途不可逆。

---

## 6. Assumptions and Defaults

1. 当前重构目标是跨框架 runtime core，Vue 只是首个 adapter。
2. 本轮不引入 Fiber/lanes/time slicing；后续按性能数据再决策。
3. 执行优先级：正确性 > 生命周期一致性 > 性能优化。
