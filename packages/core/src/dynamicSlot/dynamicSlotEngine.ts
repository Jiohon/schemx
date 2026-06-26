/**
 * Dynamic Slot Engine - 动态子树引擎（骨架）
 *
 * @module core/dynamicSlot/dynamicSlotEngine
 */

import type { DynamicSlotEngine, SlotState } from "./types"
import type { NodeId } from "../schemaGraph/types"
import type { Values } from "../types"

/**
 * Dynamic Slot Engine 实现（骨架）。
 */
export class DynamicSlotEngineImpl<TValues extends Values = Values>
  implements DynamicSlotEngine<TValues>
{
  private slotStates: Map<NodeId, SlotState> = new Map()

  mountSlot(
    nodeId: NodeId,
    to: readonly (keyof TValues)[],
    renderer: unknown
  ): void {
    // TODO: Phase 5 实现
    this.slotStates.set(nodeId, {
      currentRunId: 0,
      isRunning: false,
    })
  }

  async refreshSlot(nodeId: NodeId): Promise<void> {
    // TODO: Phase 5 实现
  }

  getSlotState(nodeId: NodeId): SlotState | undefined {
    return this.slotStates.get(nodeId)
  }

  disposeNode(nodeId: NodeId): void {
    this.slotStates.delete(nodeId)
  }
}

/**
 * 创建 DynamicSlotEngine 实例。
 */
export function createDynamicSlotEngine<
  TValues extends Values = Values
>(): DynamicSlotEngine<TValues> {
  return new DynamicSlotEngineImpl<TValues>()
}
