# Watch 回调参数顺序统一设计

## 背景

`createWatch` 与 Vue 的 `useWatch` 系列 API 已将回调签名统一为 `(snapshot, payload)`。仓库中仍有少数内部消费者和测试以旧顺序 `(payload, snapshot)` 解构参数，导致运行时会将表单快照误当作变更载荷使用。

## 范围

本次仅处理回调顺序的实现、调用方和测试同步：

- 保持 core 层公开回调类型及实际调用均为 `(snapshot, payload)`。
- 更新 Vue 层使用 `useWatch` / `useWatchFields` 的内部回调参数顺序。
- 更新 createWatch 测试的回调参数、断言与相关文字说明，验证快照始终位于第一个参数。
- 修正与该约定矛盾的简短说明文字。

不在本次范围内：为 Hook 新增或扩写 `@example` 注释。

## 方案选择

### 方案一：全链路统一（采用）

以 core 层已变更的契约为唯一标准，逐一调整内部消费者和测试。改动小、行为一致，并能由测试直接防止参数顺序回退。

## 实现设计

1. 检查 `packages/vue/src/form.vue` 和 `packages/vue/src/hooks/useDictionary.ts` 的监听回调，将参数改为 `(_snapshot, payload)` 或 `(snapshot, payload)`，并确保其后续属性访问针对正确对象。
2. 在 `packages/core/src/__tests__/createWatch.test.ts` 中将所有回调及断言改为第一个参数为 snapshot、第二个参数为 payload；补充或调整断言以覆盖 `immediate`、字段监听、多字段监听及全局监听。
3. 用 `rg` 搜索旧顺序模式，确认本任务涉及的调用链不再残留。

## 验证

- 先让更新后的针对性测试在现状代码上失败，确认其能捕捉旧顺序。
- 修改实现消费者与测试后，执行 core 的 createWatch 测试。
- 执行关联 Vue/core 的类型检查或完整测试脚本（以仓库现有命令为准）。
- 最后检查 diff，确保未纳入用户已有的其他改动。
