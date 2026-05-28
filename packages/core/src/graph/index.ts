/**
 * Graph 模块统一导出。
 *
 * 提供 Fiber、Reconciler 和资源作用域。
 *
 * @module core/graph
 */

export {
  getFiber,
  getChildFibers,
  hasDescriptor,
  isContainerFiber,
  isDependencyFiber,
  isRootFiber,
  isFieldFiber,
  isGroupFiber,
  setChildFibers,
  type ContainerFiber,
  type DependencyFiber,
  type DescribedFiber,
  type Fiber,
  type FiberType,
  type FieldFiber,
  type GroupFiber,
  type RootFiber,
} from "./fiber"

export { createReconciler, type Reconciler } from "./reconciler"

export { createFiberManager, type FiberManager } from "./fiberManager"

export {
  createScope,
  reportRuntimeCleanupError,
  type ScopeCleanup,
  type ScopeCleanupHandle,
  type Scope,
} from "./scope"
