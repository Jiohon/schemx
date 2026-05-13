/**
 * Runtime 模块入口。
 *
 * 导出表单运行时引擎的核心组件，包括 Runtime 实例、字段生命周期管理、
 * 字段属性处理、运行时图结构和树构建器。
 *
 * @module core/runtime
 */

// Runtime 实例
export { Runtime, createRuntime } from "./createRuntime"
export type { RuntimeOptions } from "./createRuntime"

// 清理工具
export { createDisposeBag } from "./disposeBag"

// 字段生命周期事件总线
export {
  createFieldLifecycle,
  type FieldLifecycleBus,
  type FieldLifecycleEvent,
  type FieldLifecycleListener,
} from "./fieldLifecycle"

// 字段属性状态管理
export {
  applyFieldProps,
  createFieldRuntime,
  readFieldProps,
  resolveFieldDefaults,
  resolveStaticProps,
} from "./fieldProps"

// 运行时图结构
export { createRuntimeGraph } from "./graph"
export type { RuntimeGraph } from "./graph"

// 树构建器（核心：编译 + 节点管理）
export { createRuntimeTreeBuilder } from "./runtimeTreeBuilder"
export type { RuntimeTreeBuilder, RuntimeTreeBuilderOptions } from "./runtimeTreeBuilder"

// Schema 规范化
export { normalizeSchemas } from "../utils/normalize"

// 节点身份策略
export { getRuntimeNodeKey } from "./identity"

// 增量对账
export { reconcileChildren } from "./reconcile"
export type { CompileNodeContext, ReconcileChildrenOptions } from "./reconcile"
