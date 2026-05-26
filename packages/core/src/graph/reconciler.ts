/**
 * Reconciler - 结构复用引擎。
 *
 * Reconciler 只处理结构复用，不理解 descriptor 的领域含义，
 * 也不发布生命周期事件。
 *
 * @module core/graph/reconciler
 */

import { isGroupDescriptor } from "../descriptor"

import { getChildFibers, setChildFibers } from "./fiber"

import type { ContainerFiber, Fiber, GroupFiber } from "./fiber"
import type { FormDescriptor } from "../descriptor"
import type { Values } from "../types"
import type { FiberManager } from "./fiberManager"

/**
 * 默认的 keyed runtime graph reconciler。
 *
 * @typeParam TValues - 表单值类型。
 */
class RuntimeReconciler<TValues extends Values> {
  /** 执行 Fiber 创建、挂载、更新和销毁的生命周期管理器。 */
  private fiberManager: FiberManager<TValues>

  constructor(fiberManager: FiberManager<TValues>) {
    this.fiberManager = fiberManager
  }

  /**
   * 将容器 Fiber 的子节点更新为目标 descriptor 列表。
   *
   * @param parent - 承载子节点的 Fiber。
   * @param descriptors - 新一轮编译后的子节点描述符。
   * @returns 子节点结构是否发生可观测变化（新增、移除、类型变更或子树变动）。
   *
   * @remarks
   * 同 key 且同 type 的 Fiber 会被复用；不同 type 即使 key 相同也会重建。
   * 新子节点会先提交到 parent，再销毁被移除的旧节点，避免 cleanup 或视图投影
   * 期间仍读取到过期结构。`viewRevision` 由外层 commit boundary 统一推进。
   */
  reconcileChildren(
    parent: ContainerFiber<TValues>,
    descriptors: FormDescriptor<TValues>[]
  ): boolean {
    return this.reconcileChildrenTree(parent, descriptors)
  }

  private reconcileChildrenTree(
    parent: ContainerFiber<TValues>,
    descriptors: FormDescriptor<TValues>[]
  ): boolean {
    const previousByKey = new Map(
      getChildFibers(parent).map((fiber) => [fiber.key, fiber])
    )
    const next: Fiber<TValues>[] = []
    const groups: Array<{
      fiber: GroupFiber<TValues>
      descriptor: FormDescriptor<TValues>
    }> = []
    let changed = false

    for (const descriptor of descriptors) {
      const existing = previousByKey.get(descriptor.key)

      if (existing && existing.type === descriptor.type) {
        previousByKey.delete(descriptor.key)

        existing.parent = parent

        this.fiberManager.update(existing, descriptor)

        next.push(existing)

        if (isGroupDescriptor(descriptor)) {
          groups.push({ fiber: existing as GroupFiber<TValues>, descriptor })
        }

        continue
      }

      // 新建或类型变更
      changed = true

      const fiber = this.fiberManager.create(descriptor, parent)

      this.fiberManager.mount(fiber)

      next.push(fiber)

      if (isGroupDescriptor(descriptor)) {
        groups.push({ fiber: fiber as GroupFiber<TValues>, descriptor })
      }
    }

    // 先提交新结构，避免 cleanup 或投影期间仍遍历旧子树。
    setChildFibers(parent, next)

    for (const { fiber, descriptor } of groups) {
      if (isGroupDescriptor(descriptor)) {
        if (this.reconcileChildrenTree(fiber, descriptor.children)) {
          changed = true
        }
      }
    }

    if (previousByKey.size > 0) {
      changed = true
    }

    for (const removed of previousByKey.values()) {
      this.fiberManager.disposeTree(removed)
    }

    return changed
  }
}

/**
 * Reconciler 的实例类型。
 */
export type Reconciler<TValues extends Values> = InstanceType<
  typeof RuntimeReconciler<TValues>
>

/**
 * 创建默认 Reconciler。
 *
 * @param fiberManager - 执行 Fiber 创建、更新和销毁的生命周期管理器。
 * @returns 新的 Reconciler 实例。
 */
export function createReconciler<TValues extends Values>(
  fiberManager: FiberManager<TValues>
): Reconciler<TValues> {
  return new RuntimeReconciler(fiberManager)
}
