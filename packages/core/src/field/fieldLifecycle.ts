/**
 * Field lifecycle event bus。
 *
 * 该模块只提供字段生命周期事件的基础设施，不执行 validation、dynamic prop
 * 或 dependency 逻辑。
 *
 * @module core/field/fieldLifecycle
 */

import { readFieldRuntimeProps } from "./fieldRuntime"

import type {
  FieldLifecycleEvent,
  FieldLifecycleEventType,
  FieldLifecycleListener,
} from "./types"
import type { FieldRuntimeNode } from "../runtime"
import type { Values } from "../types"

export interface FieldLifecycleBus<T extends Values = Values> {
  on: (
    type: FieldLifecycleEventType,
    listener: FieldLifecycleListener<T>
  ) => () => void
  emit: (event: FieldLifecycleEvent<T>) => void
  emitNode: (type: FieldLifecycleEventType, node: FieldRuntimeNode<T>) => void
  clear: () => void
}

export function createFieldLifecycle<T extends Values = Values>(): FieldLifecycleBus<T> {
  const listeners = new Map<FieldLifecycleEventType, Set<FieldLifecycleListener<T>>>()

  const on = (
    type: FieldLifecycleEventType,
    listener: FieldLifecycleListener<T>
  ): (() => void) => {
    const bucket = listeners.get(type) ?? new Set<FieldLifecycleListener<T>>()
    bucket.add(listener)
    listeners.set(type, bucket)

    return () => {
      bucket.delete(listener)
      if (bucket.size === 0) {
        listeners.delete(type)
      }
    }
  }

  const emit = (event: FieldLifecycleEvent<T>): void => {
    const bucket = listeners.get(event.type)
    if (!bucket) return

    for (const listener of [...bucket]) {
      listener(event)
    }
  }

  return {
    on,
    emit,
    emitNode: (type, node) => {
      emit({
        type,
        node,
        props: readFieldRuntimeProps(node.fieldRuntime),
      })
    },
    clear: () => listeners.clear(),
  }
}
