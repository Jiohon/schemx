/**
 * subscribeViewSchemas - ViewSchemas 订阅机制。
 *
 * 使用 createSignalEffect 追踪依赖变化，自动重新构建 ViewSchemas。
 * 读取 root view computed 作为唯一 ViewSchemas 来源。
 *
 * @module core/view/subscribeViewSchemas
 */
import { createDebouncedSignalEffect } from "../reactivity"

import type { RootRuntimeNode, RuntimeNodeResourceContext } from "../node"
import type { Values } from "../types"
import type { RootViewState, RuntimeViewState } from "./createViewState"
import type { SchemxViewSchema } from "./types"

/**
 * 订阅 ViewSchemas 变化。
 *
 * @param root - root runtime 节点。
 * @param onChange - ViewSchemas 变化回调。
 * @returns 取消订阅函数。
 */
export function subscribeViewSchemas<TValues extends Values = Values>(
  root: RootRuntimeNode<TValues>,
  _resources: RuntimeNodeResourceContext<TValues>,
  onChange: (schemas: readonly SchemxViewSchema<TValues>[]) => void
): () => void {
  let rootDisposed = false

  const rootScope = root.dispose
  const disposeHandle = rootScope.add(() => {
    rootDisposed = true
  })

  const disposeEffect = createDebouncedSignalEffect(
    () => {
      if (rootDisposed) {
        return []
      }

      const rootViewState = (
        root as RootRuntimeNode<TValues> & {
          readonly viewState?: RootViewState<TValues> | null
        }
      ).viewState

      return isRootViewState(rootViewState) ? rootViewState.viewSchemas.value : []
    },
    (viewSchemas) => {
      try {
        onChange(viewSchemas)
      } catch (error) {
        console.error("[subscribeViewSchemas] onChange error:", error)
      }
    },
    16,
    { immediate: true, edges: ["leading", "trailing"] }
  )

  const unsubscribe = (): void => {
    disposeEffect()
    disposeHandle.dispose()
    rootDisposed = false
  }

  return unsubscribe
}

function isRootViewState<TValues extends Values>(
  viewState: RuntimeViewState<TValues> | null | undefined
): viewState is RootViewState<TValues> {
  return viewState != null && "viewSchemas" in viewState
}
