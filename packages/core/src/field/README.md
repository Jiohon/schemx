# Field 边界

`packages/core/src/field/` 只放字段状态和生命周期基础设施。

## 负责

- 创建和读取 `FieldRuntime`。
- 保存字段 resolved props signals。
- 定义 field mount/update/unmount 事件类型和事件基础设施。

## 不负责

- 不计算 `schema.dependencies`。
- 不执行 dependency renderer。
- 不替换 runtime subtree。
- 不直接执行 validator rules。
- 不 import `engine/*`。

具体执行逻辑应放在 `packages/core/src/engine/`。
