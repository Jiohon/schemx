/**
 * Reconciler - 结构复用引擎。
 *
 * Reconciler 只处理结构复用和生命周期 hook，
 * 不理解 descriptor 的领域含义。
 *
 * @module core/runtime/core/reconciler
 */

import { createFiber, disposeFiber } from "./fiber"

import type { Fiber, FiberKind } from "./fiber"

/**
 * 运行时描述符，Reconciler 的输入。
 */
export interface RuntimeDescriptor {
  /**
   * 节点 key，用于 keyed reconcile。
   */
  key: string

  /**
   * 节点类型。
   */
  kind: FiberKind

  /**
   * 子描述符。
   */
  children?: RuntimeDescriptor[]

  /**
   * 领域数据，由 hooks 处理。
   */
  data?: unknown
}

/**
 * Reconcile 生命周期钩子。
 *
 * 领域层通过 hooks 挂载资源，Reconciler 不理解 descriptor 的领域含义。
 */
export interface ReconcileHooks {
  /**
   * 挂载新节点。
   *
   * @param fiber - 新创建的 Fiber
   * @param descriptor - 描述符
   */
  mount(fiber: Fiber, descriptor: RuntimeDescriptor): void

  /**
   * 更新现有节点。
   *
   * @param fiber - 复用的 Fiber
   * @param descriptor - 新描述符
   */
  update(fiber: Fiber, descriptor: RuntimeDescriptor): void

  /**
   * 卸载节点。
   *
   * @param fiber - 即将销毁的 Fiber
   */
  unmount(fiber: Fiber): void
}

/**
 * Reconciler 接口。
 */
export interface Reconciler {
  /**
   * Reconcile 子节点。
   *
   * @param parent - 父 Fiber
   * @param previous - 之前的子节点列表
   * @param descriptors - 新的描述符列表
   * @param hooks - 生命周期钩子
   * @returns 新的子节点列表
   */
  reconcileChildren(
    parent: Fiber,
    previous: Fiber[],
    descriptors: RuntimeDescriptor[],
    hooks: ReconcileHooks
  ): Fiber[]
}

/**
 * Reconciler 的运行时实现。
 */
export class RuntimeReconciler implements Reconciler {
  /**
   * 下一个 Fiber id。
   */
  #nextId = 1

  /**
   * Reconcile 子节点。
   *
   * 算法：
   * 1. 建立 previousByKey 映射
   * 2. 遍历 descriptors：
   *    - 如果存在同 key 同 kind 的 existing，复用并调用 update hook
   *    - 否则创建新 Fiber 并调用 mount hook
   * 3. 遍历 previousByKey 剩余节点，调用 unmount hook 和 disposeFiber
   * 4. 设置 parent.children
   */
  reconcileChildren(
    parent: Fiber,
    previous: Fiber[],
    descriptors: RuntimeDescriptor[],
    hooks: ReconcileHooks
  ): Fiber[] {
    // 建立 previousByKey 映射
    const previousByKey = new Map(previous.map((fiber) => [fiber.key, fiber]))
    const next: Fiber[] = []

    // 遍历 descriptors
    for (const descriptor of descriptors) {
      const existing = previousByKey.get(descriptor.key)

      // 检查是否可以复用
      if (existing && existing.kind === descriptor.kind) {
        // 复用现有 Fiber
        previousByKey.delete(descriptor.key)
        existing.parent = parent
        hooks.update(existing, descriptor)
        next.push(existing)
        continue
      }

      // 创建新 Fiber
      const fiber = createFiber({
        id: this.#nextId++,
        key: descriptor.key,
        kind: descriptor.kind,
        parent,
        scope: parent.scope.child(),
      })

      hooks.mount(fiber, descriptor)
      next.push(fiber)
    }

    // 处理移除的节点
    for (const removed of previousByKey.values()) {
      hooks.unmount(removed)
      disposeFiber(removed)
    }

    // 设置 parent.children
    parent.children = next

    return next
  }
}

/**
 * 创建一个 Reconciler 实例。
 *
 * @returns 新创建的 Reconciler
 *
 * @example
 * ```ts
 * const reconciler = createReconciler()
 *
 * const hooks: ReconcileHooks = {
 *   mount: (fiber, descriptor) => {
 *     console.log("mount:", fiber.key)
 *   },
 *   update: (fiber, descriptor) => {
 *     console.log("update:", fiber.key)
 *   },
 *   unmount: (fiber) => {
 *     console.log("unmount:", fiber.key)
 *   },
 * }
 *
 * const children = reconciler.reconcileChildren(
 *   parent,
 *   parent.children,
 *   descriptors,
 *   hooks
 * )
 * ```
 */
export function createReconciler(): Reconciler {
  return new RuntimeReconciler()
}
