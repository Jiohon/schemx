/**
 * Field runtime 共享类型。
 *
 * Field 层只描述字段状态与生命周期事件，不执行 dynamic prop、dependency
 * 或 validation 业务逻辑。
 *
 * @module core/field/types
 */

import type { Values } from "../types"
import type { FieldRuntimeNode, RuntimeFieldResolvedProps } from "../runtime"

export type FieldLifecycleEventType = "mount" | "update" | "unmount"

/**
 * 字段生命周期事件。
 *
 * 事件携带 runtime node 和当时的 resolved props 快照，监听方不需要直接读取
 * FieldRuntime signals。
 */
export interface FieldLifecycleEvent<T extends Values = Values> {
  /** 生命周期类型。 */
  type: FieldLifecycleEventType
  /** 触发生命周期的字段节点。 */
  node: FieldRuntimeNode<T>
  /** 触发时刻字段已解析属性快照。 */
  props: RuntimeFieldResolvedProps<T>
}

/** 字段生命周期监听器。 */
export type FieldLifecycleListener<T extends Values = Values> = (
  event: FieldLifecycleEvent<T>
) => void
