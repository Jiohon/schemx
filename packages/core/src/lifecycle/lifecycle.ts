/**
 * Lifecycle - Fiber 生命周期事件总线。
 *
 * Reconciler 负责决定 Fiber 的创建、复用和销毁，FiberManager 负责执行单个
 * Fiber 的生命周期动作。LifecycleBus 只观察 Fiber 生命周期，不参与内部资源挂载。
 *
 * @module core/lifecycle
 */

import type { FormDescriptor } from "../descriptor"
import type { Fiber } from "../graph"
import type { Values } from "../types"

/**
 * 兼容旧命名的完整生命周期 hooks。
 */
export interface LifecycleHooks<TNode, TDescriptor> {
  /**
   * 挂载新节点。
   */
  mount(node: TNode, descriptor: TDescriptor): void

  /**
   * 更新已有节点。
   */
  update(node: TNode, descriptor: TDescriptor): void

  /**
   * 卸载节点。
   */
  unmount(node: TNode): void
}

/**
 * Fiber 生命周期 hooks。
 */
export interface FiberLifecycleHooks<TNode, TDescriptor> {
  /**
   * Fiber 挂载前。
   */
  beforeMount(node: TNode): void

  /**
   * Fiber 挂载后。
   */
  mounted(node: TNode): void

  /**
   * Fiber 更新前。
   */
  beforeUpdate(node: TNode, previous: TDescriptor): void

  /**
   * Fiber 更新后。
   */
  updated(node: TNode, previous: TDescriptor): void

  /**
   * Fiber 卸载前。
   */
  beforeUnmount(node: TNode): void

  /**
   * Fiber 卸载后。
   */
  unmounted(node: TNode): void
}

/**
 * 生命周期事件监听器。
 *
 * 监听器允许只实现关心的事件。mount/update/unmount 是兼容旧命名的观察入口，
 * mounted/updated/unmounted 是新的 Fiber 生命周期入口。
 */
export type LifecycleListener<TNode, TDescriptor> = Partial<
  LifecycleHooks<TNode, TDescriptor> & FiberLifecycleHooks<TNode, TDescriptor>
>

/**
 * 生命周期事件总线。
 */
export interface LifecycleBus<TNode, TDescriptor> {
  /**
   * 订阅生命周期事件。
   *
   * @returns 取消订阅函数
   */
  on(listener: LifecycleListener<TNode, TDescriptor>): () => void

  /**
   * 发布 mount 事件。
   */
  emitMount(node: TNode, descriptor: TDescriptor): void

  /**
   * 发布 beforeMount 事件。
   */
  emitBeforeMount(node: TNode): void

  /**
   * 发布 update 事件。
   */
  emitUpdate(node: TNode, descriptor: TDescriptor): void

  /**
   * 发布 beforeUpdate 事件。
   */
  emitBeforeUpdate(node: TNode, previous: TDescriptor): void

  /**
   * 发布 updated 事件。
   */
  emitUpdated(node: TNode, previous: TDescriptor): void

  /**
   * 发布 beforeUnmount 事件。
   */
  emitBeforeUnmount(node: TNode): void

  /**
   * 发布 unmount 事件。
   */
  emitUnmount(node: TNode): void

  /**
   * 移除所有监听器。
   */
  clear(): void
}

/**
 * 表单内部生命周期 hooks。
 *
 * 这些 hook 由 createForm 传入，用于在表单内部资源装配后
 * 观察字段、分组和 dependency 节点的 mount/update/unmount。
 */
export type SchemxLifecycleHooks<TValues extends Values = Values> = LifecycleListener<
  Fiber,
  FormDescriptor<TValues>
>

/**
 * 创建生命周期事件总线。
 *
 * listener 按订阅顺序执行。发布事件前会复制 listener 快照，避免某个 listener
 * 在回调中订阅/取消订阅影响当前事件分发。
 */
export function createLifecycleBus<TNode, TDescriptor>(
  initialListener?: LifecycleListener<TNode, TDescriptor>
): LifecycleBus<TNode, TDescriptor> {
  const listeners = new Set<LifecycleListener<TNode, TDescriptor>>()

  if (initialListener) {
    listeners.add(initialListener)
  }

  const emit = <TArgs extends unknown[]>(
    run: (listener: LifecycleListener<TNode, TDescriptor>, ...args: TArgs) => void,
    ...args: TArgs
  ): void => {
    for (const listener of Array.from(listeners)) {
      run(listener, ...args)
    }
  }

  return {
    on: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },

    emitMount: (node, descriptor) => {
      emit(
        (listener, currentNode, currentDescriptor) => {
          listener.mount?.(currentNode, currentDescriptor)
          listener.mounted?.(currentNode)
        },
        node,
        descriptor
      )
    },

    emitBeforeMount: (node) => {
      emit((listener, currentNode) => {
        listener.beforeMount?.(currentNode)
      }, node)
    },

    emitUpdate: (node, descriptor) => {
      emit(
        (listener, currentNode, currentDescriptor) => {
          listener.update?.(currentNode, currentDescriptor)
        },
        node,
        descriptor
      )
    },

    emitBeforeUpdate: (node, previous) => {
      emit(
        (listener, currentNode, previousDescriptor) => {
          listener.beforeUpdate?.(currentNode, previousDescriptor)
        },
        node,
        previous
      )
    },

    emitUpdated: (node, previous) => {
      emit(
        (listener, currentNode, previousDescriptor) => {
          listener.updated?.(currentNode, previousDescriptor)
        },
        node,
        previous
      )
    },

    emitBeforeUnmount: (node) => {
      emit((listener, currentNode) => {
        listener.beforeUnmount?.(currentNode)
      }, node)
    },

    emitUnmount: (node) => {
      emit((listener, currentNode) => {
        listener.unmount?.(currentNode)
        listener.unmounted?.(currentNode)
      }, node)
    },

    clear: () => {
      listeners.clear()
    },
  }
}

/**
 * 兼容旧命名：创建生命周期事件总线。
 */
export const createLifecycle = createLifecycleBus
