/**
 * useViewTree - Vue ViewNode projection bridge.
 *
 * @module hooks/useViewTree
 */

import { onScopeDispose, shallowRef } from "vue"
import type { ShallowRef } from "vue"

import type { SchemxInstance, Values, ViewNode } from "@schemx/core"

export function useViewTree<T extends Values = Values>(
  form: SchemxInstance<T>
): ShallowRef<readonly ViewNode[]> {
  const viewTree = shallowRef<readonly ViewNode[]>(form.getViewTree())

  const unsubscribe = form.subscribeViewTree((nextTree) => {
    viewTree.value = nextTree
  })

  onScopeDispose(unsubscribe)

  return viewTree
}

export default useViewTree
