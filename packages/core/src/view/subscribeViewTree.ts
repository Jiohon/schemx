/**
 * subscribeViewTree - ViewTree 订阅机制。
 *
 * 使用 createReactiveEffect 追踪依赖变化，自动重新投影 ViewTree。
 *
 * @module core/view/subscribeViewTree
 */

import { createReactiveEffect } from "../reactivity"

import { projectViewTree } from "./projectViewTree"

import type { ViewNode } from "./types"
import type { RootFiber } from "../graph"
import type { ViewRevision } from "./viewRevision"
import type { SchemxFormApi, Values } from "../types"

/**
 * 订阅 ViewTree 变化。
 *
 * 使用响应式 effect 追踪 Fiber Tree 结构和字段状态变化，
 * 变化时自动调用 projectViewTree 并触发 onChange 回调。
 *
 * @param root - root Fiber
 * @param revision - 视图结构版本追踪器
 * @param onChange - 变化回调
 * @returns 取消订阅函数
 *
 * @example
 * ```ts
 * const unsubscribe = subscribeViewTree(rootFiber, viewRevision, (viewTree) => {
 *   adapter.renderer(viewTree)
 * })
 *
 * // 取消订阅
 * unsubscribe()
 * ```
 */
export function subscribeViewTree<TValues extends Values = Values>(
  root: RootFiber,
  revision: ViewRevision,
  onChange: (viewTree: readonly ViewNode[]) => void,
  formApi?: SchemxFormApi<TValues>
): () => void {
  let rootDisposed = false

  // 监听 root 销毁
  const rootScope = root.scope
  const disposeHandle = rootScope.add(() => {
    rootDisposed = true
  })

  // 创建响应式 effect
  const disposeEffect = createReactiveEffect(() => {
    // root 已销毁时，回调一次空 ViewTree 后停止
    if (rootDisposed) {
      try {
        onChange([])
      } catch {
        // 捕获 onChange 错误，不中断流程
      }

      return
    }

    // 读取 revision 以建立结构变化追踪
    void revision.revision.value

    // 计算投影
    const viewTree = projectViewTree(root, formApi)

    // 回调通知
    try {
      onChange(viewTree)
    } catch (error) {
      console.error("[subscribeViewTree] onChange error:", error)
    }
  })

  /**
   * 取消订阅。
   */
  const unsubscribe = (): void => {
    // 释放 effect
    disposeEffect()

    // 取消 root dispose 监听
    disposeHandle.dispose()

    // 重置状态
    rootDisposed = false
  }

  return unsubscribe
}
