export { RuntimeEngine, createRuntimeEngine } from "./engine"
export type { RuntimeEngineOptions } from "./engine"
export { createDisposeBag } from "./disposeBag"
export type { DisposeBag } from "./disposeBag"
export { createRuntimeGraph } from "./graph"
export type { RuntimeGraph } from "./graph"

// Runtime 只导出装配入口、graph/dispose 基础设施和节点类型契约。
// field/dynamic prop/dependency/validation 的具体执行器统一从 `../engine/*`
// 维护，framework adapter 和外部调用方应优先通过 projection/public API
// 消费运行时能力。
export type {
  DependencyRuntime,
  DependencyRuntimeNode,
  DisposeCallback,
  DisposeSubscription,
  FieldRuntime,
  FieldRuntimeNode,
  GroupRuntimeNode,
  ReactiveComputation,
  RuntimeFieldDefaultProps,
  RuntimeFieldDefaults,
  RuntimeFieldResolvedProps,
  RuntimeNode,
  RuntimeNodeBase,
  RuntimeNodeType,
  RuntimeSchema,
  SubtreeReplacement,
} from "./types"
export {
  hasChildren,
  isDependencyRuntimeNode,
  isFieldRuntimeNode,
  isGroupRuntimeNode,
} from "./types"
