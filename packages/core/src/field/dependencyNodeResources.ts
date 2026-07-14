/**
 * DependencyNodeResources - dependency 运行时节点的资源挂载与更新。
 *
 * 管理 DependencyRuntimeNode 的生命周期：创建视图状态、注册依赖索引、
 * 创建 dependency effect 并在字段变更时重建。
 *
 * @module core/field/dependencyNodeResources
 */

import { createRuntimeViewState } from "../view/createViewState"

import { createDependencyEffect } from "./dependencyEffect"

import type { DependencyDescriptor } from "../descriptor"
import type { DependencyRuntimeNode } from "../node"
import type { SchemxContext } from "../schemxContext"
import type { NamePath, Values } from "../types"

/**
 * 挂载 dependency 运行时节点的资源。
 *
 * 依次创建视图状态、注册依赖索引、创建 dependency effect。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标 dependency 运行时节点
 * @param descriptor - dependency descriptor
 * @param context - 运行时上下文
 */
export function mountDependencyNodeResources<TValues extends Values>(
  node: DependencyRuntimeNode<TValues>,
  descriptor: DependencyDescriptor<TValues>,
  context: SchemxContext<TValues>
): void {
  const resources = context.nodeResources

  createRuntimeViewState(node, descriptor, resources)
  resources.dependencyIndex.register(node)
  createDependencyEffect({
    context,
    node,
    descriptor,
    scope: node.dispose.child(),
  })
}

/**
 * 更新 dependency 运行时节点的资源。
 *
 * 当 trigger 字段列表变化时，先注销旧依赖索引，销毁旧 effect，
 * 再重新注册并创建新 effect；否则只更新视图状态。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标 dependency 运行时节点
 * @param previousDescriptor - 上一轮 descriptor（用于比较 trigger 字段）
 * @param nextDescriptor - 最新 descriptor
 * @param context - 运行时上下文
 */
export function updateDependencyNodeResources<TValues extends Values>(
  node: DependencyRuntimeNode<TValues>,
  previousDescriptor: DependencyDescriptor<TValues> | undefined,
  nextDescriptor: DependencyDescriptor<TValues>,
  context: SchemxContext<TValues>
): void {
  const resources = context.nodeResources

  createRuntimeViewState(node, nextDescriptor, resources)

  if (
    previousDescriptor &&
    hasSameTriggerFields(previousDescriptor.triggerFields, nextDescriptor.triggerFields) &&
    node.effectState
  ) {
    return
  }

  resources.dependencyIndex.unregister(node)
  node.dependencyDispose?.dispose()
  node.dependencyDispose = null
  node.effectState = null
  resources.dependencyIndex.register(node)
  createDependencyEffect({
    context,
    node,
    descriptor: nextDescriptor,
    scope: node.dispose.child(),
  })
}

/**
 * 卸载 dependency 运行时节点的资源。
 *
 * 从依赖索引中注销，销毁 effect 并清理节点引用。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标 dependency 运行时节点
 * @param context - 运行时上下文
 */
export function unmountDependencyNodeResources<TValues extends Values>(
  node: DependencyRuntimeNode<TValues>,
  context: SchemxContext<TValues>
): void {
  context.nodeResources.dependencyIndex.unregister(node)
  node.dependencyDispose?.dispose()
  node.dependencyDispose = null
  node.effectState = null
}

/**
 * 判断前后两轮 descriptor 的 trigger 字段列表是否相同。
 *
 * 如果相同则无需重建 dependency effect，可复用现有 effect 实例。
 *
 * @typeParam TValues - 表单值类型
 * @param previous - 上一轮 trigger 字段列表
 * @param next - 当前 trigger 字段列表
 * @returns 列表长度和顺序一致时返回 true
 */
function hasSameTriggerFields<TValues extends Values>(
  previous: readonly NamePath<TValues>[],
  next: readonly NamePath<TValues>[]
): boolean {
  if (previous.length !== next.length) {
    return false
  }

  return previous.every((field, index) => isSameNamePath(field, next[index]))
}

/**
 * 比较两个 NamePath 是否相等。
 *
 * 支持 string 和 string[] 两种形式的 NamePath。
 *
 * @typeParam TValues - 表单值类型
 * @param previous - 上一个 NamePath
 * @param next - 下一个 NamePath
 * @returns 两个 NamePath 相等时返回 true
 */
function isSameNamePath<TValues extends Values>(
  previous: NamePath<TValues>,
  next: NamePath<TValues> | undefined
): boolean {
  if (next === undefined) {
    return false
  }

  if (Array.isArray(previous) || Array.isArray(next)) {
    return (
      Array.isArray(previous) &&
      Array.isArray(next) &&
      previous.length === next.length &&
      previous.every((part, index) => part === next[index])
    )
  }

  return previous === next
}
