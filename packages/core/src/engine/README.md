# Runtime Engine 边界

`packages/core/src/engine/` 用来收纳具体 runtime 执行器：

- `fieldEngine.ts`：字段节点 mount/update/unmount 编排。
- `DependenciesEngine.ts`：字段动态属性计算。
- `dependencyEngine.ts`：动态结构执行与 subtree plan。
- `validationEngine.ts`：runtime field lifecycle 到 validator 的桥接。

## 依赖方向

- engine 可以依赖 `runtime/`、`validator/`、`compiler/`、`scheduler/` 和 core types 的窄接口。
- engine 不应该成为新的装配入口；装配仍由 `runtime/createRuntime.ts` 负责。
- 字段 runtime state 和 field lifecycle 基础设施归属 `runtime/`，不应反向依赖 `engine/`。
- `validator/` 不应依赖 `engine/` 或 `runtime/`。
- framework adapter 不应直接依赖 `engine/`。

## 当前状态

`RuntimeScheduler`、`RuntimeGraph`、`DisposeBag` 已接入 runtime type upgrade。
engine 内部应通过新的 `fieldRuntime`、`dependencyRuntime` 和 node lifecycle
契约访问运行时状态，不应恢复旧字段状态入口、dependency 顶层执行状态或旧
DisposeBag API。
