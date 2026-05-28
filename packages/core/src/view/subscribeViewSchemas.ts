/**
 * subscribeViewSchemas - ViewSchemas 订阅机制。
 *
 * 使用 createSignalEffect 追踪依赖变化，自动重新构建 ViewSchemas。
 *
 * @module core/view/subscribeViewSchemas
 */

import { createSignalEffect } from "../reactivity"

import { buildViewSchemas } from "./buildViewSchemas"

import type { RootFiber } from "../graph"
import type { Values } from "../types"
import type { SchemxViewSchema } from "./types"
import type { ViewRevision } from "./viewRevision"

/**
 * 订阅 ViewSchemas 变化。
 *
 * @param root - root runtime 节点。
 * @param revision - 视图结构版本追踪器。
 * @param onChange - ViewSchemas 变化回调。
 * @returns 取消订阅函数。
 */
export function subscribeViewSchemas<TValues extends Values = Values>(
  root: RootFiber<TValues>,
  revision: ViewRevision,
  onChange: (schemas: readonly SchemxViewSchema<TValues>[]) => void
): () => void {
  let rootDisposed = false

  const rootScope = root.scope
  const disposeHandle = rootScope.add(() => {
    rootDisposed = true
  })

  const disposeEffect = createSignalEffect(() => {
    if (rootDisposed) {
      try {
        onChange([])
      } catch {
        // 捕获 onChange 错误，不中断流程
      }

      return
    }

    void revision.revision.value

    const viewSchemas = buildViewSchemas<TValues>(root)

    try {
      onChange(viewSchemas)
    } catch (error) {
      console.error("[subscribeViewSchemas] onChange error:", error)
    }
  })

  const unsubscribe = (): void => {
    disposeEffect()
    disposeHandle.dispose()
    rootDisposed = false
  }

  return unsubscribe
}
