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

/**
 * Dependency Engine 配置选项。
 *
 * @typeParam T - 表单值类型
 */
export interface DependencyEngineOptions<T extends Values> {
  /**
   * 当前表单实例，供 renderer 获取值和执行副作用。
   */
  form: SchemxInstance<T>
  /**
   * 统一运行时调度器。
   */
  scheduler: RuntimeScheduler
  /**
   * 编译 renderer 返回的 children schemas。
   *
   * @param previous - 旧节点列表
   * @param schemas - 新 schema 列表
   * @param parent - 父节点
   * @param ownerPath - 所有者路径
   * @returns 编译后的节点列表
   */
  compileChildren: (
    previous: RuntimeNode<T>[],
    schemas: SchemxField<T>[],
    parent: RuntimeNode<T> | null,
    ownerPath: string
  ) => RuntimeNode<T>[]
  /**
   * 提交 dependency subtree 替换结果，由 RuntimeGraph 负责 ownership。
   *
   * @param node - dependency 节点
   * @param nextChildren - 新的子节点列表
   */
  commitSubtree: (node: DependencyRuntimeNode<T>, nextChildren: RuntimeNode<T>[]) => void
}

/**
 * Dependency Engine 挂载结果。
 */
export interface DependencyEngineMountResult {
  /**
   * 手动触发 renderer 执行。
   */
  run: () => Promise<void>
  /**
   * 释放引擎资源。
   */
  dispose: () => void
}

/**
 * 给 dependency runtime node 挂载执行行为。
 *
 * 创建一个响应式 effect 监听 dependency.to 字段变化，
 * 并提供手动触发 renderer 的 run 方法。
 *
 * @typeParam T - 表单值类型
 *
 * @param node - dependency 运行时节点
 * @param options - 引擎配置选项
 * @returns 包含 run 和 dispose 方法的挂载结果
 */
export function createDependencyEngine<T extends Values>(
  node: DependencyRuntimeNode<T>,
  options: DependencyEngineOptions<T>
): DependencyEngineMountResult {
  /**
   * 资源释放器列表。
   */
  const disposers: Array<() => void> = [
    // 注册响应式 effect，监听 dependency.to 字段变化。
    options.form.effect(() => {
      for (const path of node.schema.to) {
        // 读取 dependency.to 字段以建立响应式依赖，实际 renderer 使用快照值执行。
        void options.form.getFieldValue(path)
      }

      // 标记节点为 dirty，调度重新执行。
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

  /**
   * 执行 renderer 并更新 subtree。
   *
   * 流程：
   * 1. 递增版本号，中止旧请求
   * 2. 执行 renderer 获取新 schemas
   * 3. 编译新 schemas 为 subtree
   * 4. 提交 subtree 更新
   *
   * 竞态处理：
   * - 使用 version 防止旧结果覆盖新结果
   * - 使用 AbortController 支持取消
   */
  const run = async (): Promise<void> => {
    const runtime = node.dependencyRuntime

    if (node.disposed.value) return

    // version 用于 async renderer 防竞态：旧请求晚返回时不能覆盖新 subtree。
    const currentVersion = ++runtime.version

    // 中止之前未完成的请求。
    runtime.abortController?.abort()
    const currentAbortController = new AbortController()
    runtime.abortController = currentAbortController

    runtime.loading.value = true
    runtime.error.value = null

    try {
      // 执行 renderer，传入表单快照和 AbortSignal。
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

      // 编译 renderer 返回的 schemas。
      const nextChildren = options.compileChildren(
        node.children,
        Array.isArray(result) ? result : [],
        node,
        `${node.key}/subtree`
      )

      // 提交 subtree 更新。
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

      // 清空 subtree。
      const nextChildren = options.compileChildren(
        node.children,
        [],
        node,
        `${node.key}/subtree`
      )
      options.commitSubtree(node, nextChildren)
    } finally {
      // 只在当前版本未过期时更新 loading 状态。
      if (
        !node.disposed.value &&
        !currentAbortController.signal.aborted &&
        currentVersion === runtime.version
      ) {
        runtime.loading.value = false
      }
    }
  }

  /**
   * 释放引擎资源。
   *
   * 中止未完成的请求，推进版本号，清理 effect。
   */
  const dispose = (): void => {
    // dependency watcher 生命周期跟随 runtime node。
    node.dependencyRuntime.abortController?.abort()
    node.dependencyRuntime.version += 1
    disposers.forEach((disposeEffect) => disposeEffect())
  }

  return { run, dispose }
}

/**
 * 将错误标准化为 Error 对象。
 *
 * @param error - 原始错误
 * @returns 标准化的 Error 对象
 */
function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
