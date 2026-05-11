/**
 * Dependency runtime runner。
 *
 * 负责监听 dependency.to 指定的字段路径、调度 dirty node、执行 renderer，
 * 并把 renderer 返回的 schema 增量编译成 dependency subtree。
 *
 * @module core/runtime/dependencyRunner
 */

import type { DependencyScheduler } from "../scheduler/dependencyScheduler"
import type { SchemxField, SchemxInstance, Values } from "../types"
import type { DependencyRuntimeNode, RuntimeNode } from "./types"

export interface DependencyRunnerOptions<T extends Values> {
  /** 当前表单实例，供 renderer 获取值和执行副作用 */
  form: SchemxInstance<T>
  /** dependency 脏队列调度器 */
  scheduler: DependencyScheduler<T>
  /** 编译 renderer 返回的 children schemas */
  compileChildren: (
    previous: RuntimeNode<T>[],
    schemas: SchemxField<T>[],
    parent: RuntimeNode<T> | null,
    ownerPath: string
  ) => RuntimeNode<T>[]
  /** 通知 idle tracker 增减 pending 数 */
  onPendingChange: (delta: number) => void
  /** subtree 变化后通知 engine revision 更新 */
  onTreeChange: () => void
}

export interface DependencyRunner {
  run: () => Promise<void>
  dispose: () => void
}

/**
 * 给 dependency runtime node 挂载执行行为。
 */
export function createDependencyRunner<T extends Values>(
  node: DependencyRuntimeNode<T>,
  options: DependencyRunnerOptions<T>
): DependencyRunner {
  const disposers: Array<() => void> = [
    options.form.effect(() => {
      for (const path of node.schema.to) {
        // 读取 dependency.to 字段以建立响应式依赖，实际 renderer 使用快照值执行。
        void options.form.getFieldValue(path)
      }

      options.scheduler.enqueueDependency(node)
    }),
  ]

  const run = async (): Promise<void> => {
    if (node.disposed) return

    // version 用于 async renderer 防竞态：旧请求晚返回时不能覆盖新 subtree。
    const currentVersion = ++node.version

    options.onPendingChange(1)
    node.loading.value = true
    node.error.value = null

    try {
      const result = await node.schema.renderer(
        options.form.getFieldsSnapshot() as T,
        options.form
      )

      // 节点已销毁或已有更新版本执行过时，丢弃当前结果。
      if (node.disposed || currentVersion !== node.version) {
        return
      }

      node.children = options.compileChildren(
        node.children,
        Array.isArray(result) ? result : [],
        node,
        `${node.key}/subtree`
      )
      node.subtree.value = node.children
      options.onTreeChange()
    } catch (runtimeError) {
      // renderer 异常时清空 subtree，让 projection 与错误状态保持一致。
      if (node.disposed || currentVersion !== node.version) {
        return
      }

      node.error.value = runtimeError
      node.children = options.compileChildren(
        node.children,
        [],
        node,
        `${node.key}/subtree`
      )
      node.subtree.value = node.children
      options.onTreeChange()
    } finally {
      if (!node.disposed && currentVersion === node.version) {
        node.loading.value = false
      }

      options.onPendingChange(-1)
    }
  }

  const dispose = (): void => {
    // dependency watcher 生命周期跟随 runtime node。
    disposers.forEach((disposeEffect) => disposeEffect())
  }

  return { run, dispose }
}
