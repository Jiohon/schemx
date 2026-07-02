/**
 * Graph 模块统一导出。
 *
 * 提供 RuntimeNode、RuntimeNodeManager 和资源作用域。
 *
 * @module core/node
 */

export {
  createDependencyRuntimeNode,
  createFieldRuntimeNode,
  createGroupRuntimeNode,
  createRootRuntimeNode,
  getChildRuntimeNodes,
  setChildRuntimeNodes,
} from "./runtimeNode"

export {
  createRuntimeResources,
  deleteNodeResources,
} from "./resources"

export type {
  ContainerRuntimeNode,
  CreateDependencyRuntimeNodeOptions,
  CreateFieldRuntimeNodeOptions,
  CreateGroupRuntimeNodeOptions,
  CreateRootRuntimeNodeOptions,
  CreateRuntimeNodeManagerOptions,
  CreateRuntimeNodeOptions,
  DependencyRuntimeNode,
  DescribedRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RootRuntimeNode,
  RuntimeChildrenState,
  RuntimeNode,
  RuntimeNodeId,
  RuntimeNodeManager,
  RuntimeNodeResourceContext,
  RuntimeNodeResourceMaps,
  RuntimeNodeType,
  Scope,
  ScopeCleanup,
  ScopeCleanupHandle,
} from "./types"

export { createRuntimeNodeManager } from "./runtimeNodeManager"

export {
  createRuntimeLifecycle,
  type RuntimeLifecycle,
} from "./runtimeLifecycle"

export {
  createScope,
  reportRuntimeCleanupError,
} from "./scope"
