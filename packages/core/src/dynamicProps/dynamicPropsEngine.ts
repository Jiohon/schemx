/**
 * Dynamic Props Engine - 动态属性引擎（骨架）
 *
 * @module core/dynamicProps/dynamicPropsEngine
 */

import type { DynamicPropsEngine, DynamicOverrides, OverrideStore } from "./types"
import type { NodeId } from "../schemaGraph/types"
import type { Values } from "../types"
import { createOverrideStore } from "./overrideStore"

/**
 * Dynamic Props Engine 实现（骨架）。
 */
export class DynamicPropsEngineImpl<TValues extends Values = Values>
  implements DynamicPropsEngine<TValues>
{
  readonly overrideStore: OverrideStore

  constructor() {
    this.overrideStore = createOverrideStore()
  }

  mountField(nodeId: NodeId, dependencies: unknown): void {
    // TODO: Phase 4 实现
  }

  getOverrides(nodeId: NodeId): DynamicOverrides {
    const record = this.overrideStore.get(nodeId)
    return record?.overrides || {}
  }

  disposeNode(nodeId: NodeId): void {
    this.overrideStore.delete(nodeId)
  }
}

/**
 * 创建 DynamicPropsEngine 实例。
 */
export function createDynamicPropsEngine<
  TValues extends Values = Values
>(): DynamicPropsEngine<TValues> {
  return new DynamicPropsEngineImpl<TValues>()
}
