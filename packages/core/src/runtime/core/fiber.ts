/**
 * Fiber - Runtime Core 的唯一结构节点。
 *
 * Fiber 不感知 schema、form、validation、renderer。
 * 只表达：
 * - 身份（id, key, kind）
 * - 父子结构（parent, children）
 * - 所有权（scope）
 * - 生命周期（disposed）
 * - 可扩展资源槽（resources）
 *
 * @module core/runtime/core/fiber
 */

import { createSignal } from "../../reactivity"
import { createRuntimeScope } from "./scope"
import { createResourceMap } from "./resource"

import type { ReactiveSignal } from "../../reactivity"
import type { RuntimeScope } from "./scope"
import type { ResourceMap } from "./resource"

/**
 * Fiber 类型枚举。
 */
export type FiberKind = "root" | "field" | "group" | "slot" | "fragment"

/**
 * Fiber 结构节点。
 */
export interface Fiber {
  /**
   * 唯一标识符，由 Reconciler 分配。
   */
  readonly id: number

  /**
   * 节点 key，用于 keyed reconcile。
   */
  readonly key: string

  /**
   * 节点类型。
   */
  readonly kind: FiberKind

  /**
   * 父节点，root 为 null。
   */
  parent: Fiber | null

  /**
   * 子节点列表。
   */
  children: Fiber[]

  /**
   * 生命周期作用域。
   */
  scope: RuntimeScope

  /**
   * 可扩展资源容器。
   */
  resources: ResourceMap

  /**
   * 是否已销毁。
   */
  disposed: ReactiveSignal<boolean>
}

/**
 * 创建 Fiber 的配置选项。
 */
export interface CreateFiberOptions {
  /**
   * 唯一标识符。
   */
  id: number

  /**
   * 节点 key。
   */
  key: string

  /**
   * 节点类型。
   */
  kind: FiberKind

  /**
   * 父节点，可选。
   */
  parent?: Fiber | null

  /**
   * 生命周期作用域，可选。
   */
  scope?: RuntimeScope
}

/**
 * 创建一个 Fiber 实例。
 *
 * @param options - 配置选项
 * @returns 新创建的 Fiber
 *
 * @example
 * ```ts
 * // 创建 root Fiber
 * const root = createFiber({
 *   id: 0,
 *   key: "root",
 *   kind: "root",
 * })
 *
 * // 创建子 Fiber
 * const child = createFiber({
 *   id: 1,
 *   key: "field-1",
 *   kind: "field",
 *   parent: root,
 * })
 * ```
 */
export function createFiber(options: CreateFiberOptions): Fiber {
  const { id, key, kind, parent = null, scope } = options

  return {
    id,
    key,
    kind,
    parent,
    children: [],
    scope: scope ?? createRuntimeScope(),
    resources: createResourceMap(),
    disposed: createSignal(false),
  }
}

/**
 * 销毁 Fiber 及其所有子节点。
 *
 * 按先子后父顺序释放，幂等操作。
 *
 * @param fiber - 要销毁的 Fiber
 *
 * @example
 * ```ts
 * const root = createFiber({ id: 0, key: "root", kind: "root" })
 * const child = createFiber({ id: 1, key: "child", kind: "field", parent: root })
 * root.children.push(child)
 *
 * disposeFiber(root)
 * // → child.scope.dispose() 先执行
 * // → root.scope.dispose() 后执行
 * // → root.disposed = true
 * ```
 */
export function disposeFiber(fiber: Fiber): void {
  // 幂等检查
  if (fiber.disposed.value) {
    return
  }

  // 先子后父释放
  for (const child of fiber.children) {
    disposeFiber(child)
  }

  // 清空 children
  fiber.children = []

  // 释放 scope
  fiber.scope.dispose()

  // 清理 resources
  fiber.resources.clear()

  // 断开父节点引用
  fiber.parent = null

  // 标记已销毁
  fiber.disposed.value = true
}
