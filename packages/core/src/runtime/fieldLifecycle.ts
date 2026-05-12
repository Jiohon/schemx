/**
 * Field lifecycle event bus。
 *
 * 该模块只提供字段生命周期事件的基础设施，不执行 validation、dynamic prop
 * 或 dependency 逻辑。
 *
 * @module core/runtime/fieldLifecycle
 */

import { readFieldProps } from "./fieldProps"

import type { FieldRuntimeNode, RuntimeFieldResolvedProps, Values } from "../types"

/**
 * 字段生命周期事件类型。
 */
export type FieldLifecycleEventType = "mount" | "update" | "unmount"

/**
 * 字段生命周期事件。
 *
 * 事件携带 runtime node 和当时的 resolved props 快照，监听方不需要直接读取
 * FieldRuntime signals。
 *
 * @typeParam T - 表单值类型
 *
 * @example
 * ```ts
 * const event: FieldLifecycleEvent<FormValues> = {
 *   type: 'mount',
 *   node: fieldNode,
 *   props: readFieldProps(fieldNode.fieldRuntime),
 * }
 * ```
 */
export interface FieldLifecycleEvent<T extends Values = Values> {
  /**
   * 生命周期类型。
   */
  type: FieldLifecycleEventType
  /**
   * 触发生命周期的字段节点。
   */
  node: FieldRuntimeNode<T>
  /**
   * 触发时刻字段已解析属性快照。
   */
  props: RuntimeFieldResolvedProps<T>
}

/**
 * 字段生命周期监听器。
 *
 * 接收生命周期事件并执行自定义逻辑。
 *
 * @typeParam T - 表单值类型
 *
 * @param event - 生命周期事件
 */
export type FieldLifecycleListener<T extends Values = Values> = (
  event: FieldLifecycleEvent<T>
) => void

/**
 * 字段生命周期事件总线。
 *
 * runtime field engine 通过它派发 mount/update/unmount 事件；监听方只消费
 * 事件快照，不直接操作 FieldRuntime。
 *
 * @typeParam T - 表单值类型
 *
 * @example
 * ```ts
 * const bus = createFieldLifecycle<FormValues>()
 *
 * // 订阅 mount 事件
 * const unsubscribe = bus.on('mount', (event) => {
 *   console.log('Field mounted:', event.node.key)
 * })
 *
 * // 派发事件
 * bus.emitNode('mount', fieldNode)
 *
 * // 取消订阅
 * unsubscribe()
 *
 * // 清空所有监听器
 * bus.clear()
 * ```
 */
export interface FieldLifecycleBus<T extends Values = Values> {
  /**
   * 订阅指定生命周期事件。
   *
   * @param type - 事件类型
   * @param listener - 事件监听器
   * @returns 取消订阅函数
   */
  on: (type: FieldLifecycleEventType, listener: FieldLifecycleListener<T>) => () => void
  /**
   * 派发完整生命周期事件。
   *
   * @param event - 生命周期事件
   */
  emit: (event: FieldLifecycleEvent<T>) => void
  /**
   * 从 FieldRuntimeNode 读取 resolved props 并派发事件。
   *
   * @param type - 事件类型
   * @param node - 字段运行时节点
   */
  emitNode: (type: FieldLifecycleEventType, node: FieldRuntimeNode<T>) => void
  /**
   * 清空所有监听器。
   */
  clear: () => void
}

/**
 * 创建字段生命周期事件总线。
 *
 * 返回一个事件总线实例，用于管理字段生命周期事件的订阅和派发。
 *
 * @typeParam T - 表单值类型
 *
 * @returns 字段生命周期事件总线
 *
 * @example
 * ```ts
 * const bus = createFieldLifecycle<FormValues>()
 *
 * // 订阅 mount 事件
 * bus.on('mount', (event) => {
 *   console.log('Field mounted:', event.node.key)
 * })
 *
 * // 派发 mount 事件
 * bus.emitNode('mount', fieldNode)
 * ```
 */
export function createFieldLifecycle<T extends Values = Values>(): FieldLifecycleBus<T> {
  /**
   * 按事件类型分组的监听器集合。
   */
  const listeners = new Map<FieldLifecycleEventType, Set<FieldLifecycleListener<T>>>()

  /**
   * 订阅指定类型的生命周期事件。
   *
   * @param type - 事件类型
   * @param listener - 事件监听器
   * @returns 取消订阅函数
   */
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

  /**
   * 派发生命周期事件。
   *
   * @param event - 生命周期事件
   */
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
        props: readFieldProps(node.fieldRuntime),
      })
    },
    clear: () => listeners.clear(),
  }
}
