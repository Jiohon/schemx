# Schemx Runtime Refactor Migration Guide

> 适用范围：runtime refactor A-E 阶段后的 `@schemx/core` 与 `@schemx/vue`。

## 迁移结论

业务侧仍以 `createForm({ schemas })` 或 `<SchemxForm :schemas="schemas" />` 作为入口。新的 runtime tree 是内部实施细节，负责 dependency 调度与 subtree 生命周期；Vue 主表单消费的是 `getResolvedSchemas()` 派生出的 schema projection，不要求业务 schema 改写。

## 行为差异

1. dependency 现在由 core runtime 执行，不再由 Vue `useDependency` 主链路计算。
2. dependency renderer 的异步结果使用 versioning，后触发结果会覆盖先触发结果，旧 Promise 不再回写。
3. dependency subtree 卸载时会同步清理字段 rules 和 errors，提交时不会再校验已卸载字段。
4. Vue 主表单按 resolved schema projection 渲染，dependency 节点会被 renderer 返回的 schema subtree 替换。
5. `getResolvedSchemas()` 返回 dependency 已展开后的 schema projection；`getSchemas()` 仍可用，但只是兼容别名，不再代表 raw schemas。

## 废弃 API

以下 API 暂时保留，作为旧适配代码和测试的兼容层：

- `createFormInstance`：请迁移到 `createForm`。
- `FORM_INSTANCE_KEY`：请迁移到 `SCHEMX_INSTANCE_KEY`。
- `form.getRenderer/registerRenderer/hasRenderer`
- `form.getRule/registerRule/hasRule`

框架适配层应优先使用 `form.getInternalHooks()` 获取内部能力。业务代码不建议直接操作 renderer/rule registry。

## 性能变化

1. dependency 调度使用 microtask batching，同一个同步栈内多次字段变更会合并刷新。
2. 目前未引入 Fiber、lanes 或 time-slicing；后续仅在真实性能数据证明需要时升级调度模型。
3. runtime 会保留 Raw Schema immutable，所有可变状态放在 runtime node 上，避免动态 dependency 反复改写原始 schema。

## 发布策略

1. 发布 `next` 或 `beta` 版本。
2. 选择包含嵌套 dependency、异步 renderer、动态 visible/disabled/readonly 的真实业务表单灰度。
3. 灰度期间重点观察提交成功率、依赖切换错误、字段校验残留和渲染抖动。
4. 灰度通过后发布 stable。

## 回滚策略

1. 若出现 dependency 渲染或校验残留问题，优先回滚 Stage D Vue adapter。
2. 若出现 runtime subtree 生命周期问题，回滚 Stage B/C runtime lifecycle 与旧链路下线改动。
3. 回滚时保留业务 schema 不变，避免把实现问题扩散到业务配置层。

## 常见排障

1. dependency 字段没有渲染：确认 `to` 字段已写入值，并等待 `form.waitForDependencies()`。
2. 异步 renderer 结果被忽略：确认是否存在后触发的 dependency 更新，versioning 会丢弃旧结果。
3. 字段卸载后错误消失：这是新行为，卸载字段不再参与提交校验。
4. 自定义 Vue 子组件需要 schema list：优先使用 `form.getResolvedSchemas()`，兼容场景可继续使用 `form.getSchemas()`。
