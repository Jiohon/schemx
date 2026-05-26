/**
 * Graph 模块统一导出。
 *
 * 提供 Fiber、Reconciler 和资源作用域。
 *
 * @module core/graph
 */

export {
  getChildFibers,
  hasDescriptor,
  isContainerFiber,
  isDependencyFiber,
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
  type DisposeFn,
  type DisposeHandle,
  type Scope,
} from "./scope"
