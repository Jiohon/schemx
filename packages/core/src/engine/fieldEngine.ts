/**
 * Field Engine。
 *
 * 负责字段节点 mount/update/unmount 的生命周期编排。它不执行校验规则、
 * 不计算 dynamic prop，也不执行 dependency renderer。
 *
 * @module core/engine/fieldEngine
 */

import { createFieldLifecycle, readFieldProps } from "../runtime"

import type { FormRuntimeContext } from "../runtime/context"
import type {
  FieldLifecycleBus,
  FieldLifecycleEvent,
  FieldLifecycleListener,
} from "../runtime/fieldLifecycle"
import type { FieldRuntimeNode, Values } from "../types"

export interface FieldEngineOptions<T extends Values = Values> {
  /** runtime 与 createForm 的字段生命周期边界。 */
  context: FormRuntimeContext<T>
  /** 可注入 lifecycle bus，主要用于测试或未来调试工具订阅。 */
  lifecycle?: FieldLifecycleBus<T>
}

/**
 * 字段生命周期执行器。
 *
 * FieldEngine 只负责把 runtime field node 的 mount/update/unmount 事件同步给
 * createForm 和 lifecycle bus，不直接执行 validation 或 dynamic prop 逻辑。
 */
export interface FieldEngine<T extends Values = Values> {
  /** 字段生命周期事件总线。 */
  lifecycle: FieldLifecycleBus<T>
  /** 订阅指定生命周期事件。 */
  on: (
    type: FieldLifecycleEvent<T>["type"],
    listener: FieldLifecycleListener<T>
  ) => () => void
  /** 挂载字段节点并触发 onFieldMount。 */
  mount: (node: FieldRuntimeNode<T>) => void
  /** 字段 resolved props 变化后触发 onFieldUpdate。 */
  update: (node: FieldRuntimeNode<T>) => void
  /** 卸载字段节点并触发 onFieldUnmount。 */
  unmount: (node: FieldRuntimeNode<T>) => void
}

/**
 * 创建字段生命周期执行器。
 */
export function createFieldEngine<T extends Values = Values>(
  options: FieldEngineOptions<T>
): FieldEngine<T> {
  const lifecycle = options.lifecycle ?? createFieldLifecycle<T>()
  const emit = (type: FieldLifecycleEvent<T>["type"], node: FieldRuntimeNode<T>) => {
    lifecycle.emit({
      type,
      node,
      props: readFieldProps(node.fieldRuntime),
    })
  }

  return {
    lifecycle,
    on: lifecycle.on,
    mount: (node) => {
      if (node.mounted || node.disposed.value) return

      node.mounted = true
      emit("mount", node)
      options.context.onFieldMount?.(node)
    },
    update: (node) => {
      if (!node.mounted || node.disposed.value) return

      emit("update", node)
      options.context.onFieldUpdate?.(node)
    },
    unmount: (node) => {
      if (!node.mounted) return

      node.mounted = false
      emit("unmount", node)
      options.context.onFieldUnmount?.(node)
    },
  }
}
