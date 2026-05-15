/**
 * Runtime Core Kernel - 框架无关、领域无关的 reactive kernel。
 *
 * @module core/runtime/core
 */

export type { FiberKind, Fiber, CreateFiberOptions } from "./fiber"
export { createFiber, disposeFiber } from "./fiber"

export type { DisposeFn, DisposeHandle, RuntimeScope } from "./scope"
export { createRuntimeScope } from "./scope"

export type { ResourceKey, ResourceMap } from "./resource"
export { createResourceKey, createResourceMap } from "./resource"

export type { RuntimeDescriptor, ReconcileHooks, Reconciler } from "./reconciler"
export { createReconciler } from "./reconciler"

export type { TaskPriority, ScheduledTask, RuntimeScheduler } from "./scheduler"
export { createRuntimeScheduler } from "./scheduler"
