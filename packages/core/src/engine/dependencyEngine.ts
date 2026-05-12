/**
 * Dependency Engine。
 *
 * 负责监听 dependency.to 指定的字段路径、调度 dirty node、执行 renderer，
 * 并把 renderer 返回的 schema 增量编译成 dependency subtree。
 *
 * @module core/engine/dependencyEngine
 */

import type { RuntimeScheduler } from "../scheduler"
import type {
  DependencyRuntimeNode,
  RuntimeNode,
  SchemxField,
  SchemxInstance,
  Values,
} from "../types"

export interface DependencyEngineOptions<T extends Values> {
  /** 当前表单实例，供 renderer 获取值和执行副作用 */
  form: SchemxInstance<T>
  /** 统一运行时调度器 */
  scheduler: RuntimeScheduler
  /** 编译 renderer 返回的 children schemas */
  compileChildren: (
    previous: RuntimeNode<T>[],
    schemas: SchemxField<T>[],
    parent: RuntimeNode<T> | null,
    ownerPath: string
  ) => RuntimeNode<T>[]
  /** 提交 dependency subtree 替换结果，由 RuntimeGraph 负责 ownership。 */
  commitSubtree: (node: DependencyRuntimeNode<T>, nextChildren: RuntimeNode<T>[]) => void
}

export interface DependencyEngineMountResult {
  run: () => Promise<void>
  dispose: () => void
}

/**
 * 给 dependency runtime node 挂载执行行为。
 */
export function createDependencyEngine<T extends Values>(
  node: DependencyRuntimeNode<T>,
  options: DependencyEngineOptions<T>
): DependencyEngineMountResult {
  const disposers: Array<() => void> = [
    options.form.effect(() => {
      for (const path of node.schema.to) {
        // 读取 dependency.to 字段以建立响应式依赖，实际 renderer 使用快照值执行。
        void options.form.getFieldValue(path)
      }

      node.dirty = true
      options.scheduler.queue({
        channel: "dependency",
        key: node.key,
        run: () => {
          node.dirty = false

          return node.dependencyRuntime.run().catch((error: unknown) => {
            node.dependencyRuntime.error.value =
              error instanceof Error ? error : new Error(String(error))
            node.dependencyRuntime.loading.value = false
          })
        },
      })
    }),
  ]

  const run = async (): Promise<void> => {
    const runtime = node.dependencyRuntime

    if (node.disposed.value) return

    // version 用于 async renderer 防竞态：旧请求晚返回时不能覆盖新 subtree。
    const currentVersion = ++runtime.version
    runtime.abortController?.abort()
    const currentAbortController = new AbortController()
    runtime.abortController = currentAbortController

    runtime.loading.value = true
    runtime.error.value = null

    try {
      const result = await node.schema.renderer(
        options.form.getFieldsSnapshot() as T,
        options.form,
        { signal: currentAbortController.signal }
      )

      // 节点已销毁或已有更新版本执行过时，丢弃当前结果。
      if (
        node.disposed.value ||
        currentAbortController.signal.aborted ||
        currentVersion !== runtime.version
      ) {
        return
      }

      const nextChildren = options.compileChildren(
        node.children,
        Array.isArray(result) ? result : [],
        node,
        `${node.key}/subtree`
      )
      options.commitSubtree(node, nextChildren)
    } catch (runtimeError) {
      // renderer 异常时清空 subtree，让 resolved schema 与错误状态保持一致。
      if (
        node.disposed.value ||
        currentAbortController.signal.aborted ||
        currentVersion !== runtime.version
      ) {
        return
      }

      runtime.error.value = normalizeError(runtimeError)
      const nextChildren = options.compileChildren(
        node.children,
        [],
        node,
        `${node.key}/subtree`
      )
      options.commitSubtree(node, nextChildren)
    } finally {
      if (
        !node.disposed.value &&
        !currentAbortController.signal.aborted &&
        currentVersion === runtime.version
      ) {
        runtime.loading.value = false
      }
    }
  }

  const dispose = (): void => {
    // dependency watcher 生命周期跟随 runtime node。
    node.dependencyRuntime.abortController?.abort()
    node.dependencyRuntime.version += 1
    disposers.forEach((disposeEffect) => disposeEffect())
  }

  return { run, dispose }
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
