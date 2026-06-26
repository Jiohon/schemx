/**
 * Override Store - 动态属性覆盖存储（骨架）
 *
 * @module core/dynamicProps/overrideStore
 */

import type { OverrideStore, OverrideRecord, DynamicOverrides } from "./types"
import type { NodeId } from "../schemaGraph/types"

/**
 * Override Store 实现（骨架）。
 */
export class OverrideStoreImpl implements OverrideStore {
  private records: Map<NodeId, OverrideRecord> = new Map()

  set(nodeId: NodeId, record: OverrideRecord): void {
    this.records.set(nodeId, record)
  }

  get(nodeId: NodeId): OverrideRecord | undefined {
    return this.records.get(nodeId)
  }

  has(nodeId: NodeId): boolean {
    return this.records.has(nodeId)
  }

  delete(nodeId: NodeId): void {
    this.records.delete(nodeId)
  }

  allNodeIds(): readonly NodeId[] {
    return Array.from(this.records.keys())
  }
}

/**
 * 创建 OverrideStore 实例。
 */
export function createOverrideStore(): OverrideStore {
  return new OverrideStoreImpl()
}
