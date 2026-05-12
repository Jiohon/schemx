/**
 * Field Engine。
 *
 * 负责字段节点 mount/update/unmount 的生命周期编排。它不执行校验规则、
 * 不计算 dependencies，也不执行 dependency renderer。
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

/**
 * Field Engine 配置选项。
 *
 * @typeParam T - 表单值类型
 */
export interface FieldEngineOptions<T extends Values = Values> {
  /**
   * runtime 与 createForm 的字段生命周期边界。
   */
  context: FormRuntimeContext<T>
  /**
   * 可注入 lifecycle bus，主要用于测试或未来调试工具订阅。
   */
  lifecycle?: FieldLifecycleBus<T>
}

/**
 * 字段生命周期执行器。
 *
 * FieldEngine 只负责把 runtime field node 的 mount/update/unmount 事件同步给
 * createForm 和 lifecycle bus，不直接执行 validation 或 dependencies 逻辑。
 *
 * @typeParam T - 表单值类型
 */
export interface FieldEngine<T extends Values = Values> {
  /**
   * 字段生命周期事件总线。
   */
  lifecycle: FieldLifecycleBus<T>
  /**
   * 订阅指定生命周期事件。
   *
   * @param type - 事件类型
   * @param listener - 事件监听器
   * @returns 取消订阅函数
   */
  on: (
    type: FieldLifecycleEvent<T>["type"],
    listener: FieldLifecycleListener<T>
  ) => () => void
  /**
   * 挂载字段节点并触发 onFieldMount。
   *
   * @param node - 字段运行时节点
   */
  mount: (node: FieldRuntimeNode<T>) => void
  /**
   * 字段 resolved props 变化后触发 onFieldUpdate。
   *
   * @param node - 字段运行时节点
   */
  update: (node: FieldRuntimeNode<T>) => void
  /**
   * 卸载字段节点并触发 onFieldUnmount。
   *
   * @param node - 字段运行时节点
   */
  unmount: (node: FieldRuntimeNode<T>) => void
}

/**
 * 创建字段生命周期执行器。
 *
 * @typeParam T - 表单值类型
 *
 * @param options - 配置选项
 * @returns 字段引擎实例
 */
export function createFieldEngine<T extends Values = Values>(
  options: FieldEngineOptions<T>
): FieldEngine<T> {
  // 创建或使用注入的 lifecycle bus。
  const lifecycle = options.lifecycle ?? createFieldLifecycle<T>()

  /**
   * 派发生命周期事件。
   *
   * @param type - 事件类型
   * @param node - 字段运行时节点
   */
  const emit = (
    type: FieldLifecycleEvent<T>["type"],
    node: FieldRuntimeNode<T>
  ): void => {
    lifecycle.emit({
      type,
      node,
      // 读取当前 resolved props 作为事件快照。
      props: readFieldProps(node.fieldRuntime),
    })
  }

  return {
    lifecycle,
    on: lifecycle.on,
    mount: (node) => {
      // 已挂载或已销毁则跳过。
      if (node.mounted || node.disposed.value) return

      node.mounted = true

      // 先派发事件，再调用 context 回调。
      emit("mount", node)
      options.context.onFieldMount?.(node)
    },
    update: (node) => {
      // 未挂载或已销毁则跳过。
      if (!node.mounted || node.disposed.value) return

      emit("update", node)
      options.context.onFieldUpdate?.(node)
    },
    unmount: (node) => {
      // 未挂载则跳过。
      if (!node.mounted) return

      node.mounted = false

      emit("unmount", node)
      options.context.onFieldUnmount?.(node)
    },
  }
}
