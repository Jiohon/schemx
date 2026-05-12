/**
 * Runtime tree ownership。
 *
 * RuntimeGraph 负责 root/subtree 挂载、替换、parent 指针修正、stale node 释放
 * 和结构 revision。compiler 仍负责生成节点；graph 负责提交结构变更。
 *
 * @module core/runtime/graph
 */

import { createSignal } from "../reactivity"

import type {
  DependencyRuntimeNode,
  GroupRuntimeNode,
  RuntimeNode,
  Values,
} from "../types"

/**
 * Runtime 图结构接口。
 *
 * 管理 runtime tree 的所有权，提供 root/subtree 挂载、替换、
 * parent 指针修正、stale node 释放和结构 revision 等功能。
 *
 * @typeParam T - 表单值类型
 *
 * @example
 * ```ts
 * const graph = createRuntimeGraph<FormValues>()
 *
 * // 设置根节点
 * graph.setRoot(rootNodes)
 *
 * // 获取当前版本
 * const revision = graph.revision
 *
 * // 替换子树
 * graph.replaceSubtree(dependencyNode, newChildren)
 *
 * // 销毁图
 * graph.dispose()
 * ```
 */
export interface RuntimeGraph<T extends Values = Values> {
  /**
   * 当前图结构版本号。
   *
   * 每次 setRoot 或 replaceSubtree 后递增。
   */
  readonly revision: number
  /**
   * 获取运行时树根节点。
   *
   * 读取版本 signal 以便在响应式 effect 中自动追踪变化。
   *
   * @returns runtime root 节点数组
   */
  getRoot: () => RuntimeNode<T>[]
  /**
   * 设置运行时树根节点。
   *
   * 会释放不在新列表中的旧节点，修正 parent 指针，并递增版本号。
   *
   * @param nodes - 新的根节点数组
   */
  setRoot: (nodes: RuntimeNode<T>[]) => void
  /**
   * 替换指定节点的子树。
   *
   * 会释放不在新列表中的旧子节点，修正 parent 指针，并递增版本号。
   *
   * @param owner - 子树所有者（dependency 或 group 节点）
   * @param nextChildren - 新的子节点数组
   */
  replaceSubtree: (
    owner: DependencyRuntimeNode<T> | GroupRuntimeNode<T>,
    nextChildren: RuntimeNode<T>[]
  ) => void
  /**
   * 销毁图结构。
   *
   * 递归释放所有根节点，清空根列表，并递增版本号。
   */
  dispose: () => void
}

/**
 * 创建 Runtime 图结构。
 *
 * 返回一个图实例，用于管理 runtime tree 的所有权和结构版本。
 *
 * @typeParam T - 表单值类型
 *
 * @returns Runtime 图结构实例
 *
 * @example
 * ```ts
 * const graph = createRuntimeGraph<FormValues>()
 *
 * // 设置根节点
 * graph.setRoot([fieldNode, groupNode])
 *
 * // 获取当前版本
 * console.log('Current revision:', graph.revision)
 * ```
 */
export function createRuntimeGraph<T extends Values = Values>(): RuntimeGraph<T> {
  /**
   * 版本号响应式信号。
   */
  const revisionSignal = createSignal(0)
  /**
   * 根节点列表。
   */
  let root: RuntimeNode<T>[] = []

  /**
   * 递增版本号。
   */
  const bumpRevision = (): void => {
    revisionSignal.value += 1
  }

  /**
   * 设置根节点。
   *
   * @param nodes - 新的根节点数组
   */
  const setRoot = (nodes: RuntimeNode<T>[]): void => {
    disposeRemoved(root, nodes)
    root = nodes
    attachParent(root, null)
    bumpRevision()
  }

  /**
   * 替换子树。
   *
   * @param owner - 子树所有者
   * @param nextChildren - 新的子节点数组
   */
  const replaceSubtree = (
    owner: DependencyRuntimeNode<T> | GroupRuntimeNode<T>,
    nextChildren: RuntimeNode<T>[]
  ): void => {
    disposeRemoved(owner.children, nextChildren)
    owner.children = nextChildren
    attachParent(nextChildren, owner)

    if (owner.type === "dependency") {
      owner.dependencyRuntime.subtree.value = nextChildren
    }

    bumpRevision()
  }

  /**
   * 销毁图。
   */
  const dispose = (): void => {
    root.forEach((node) => node.dispose())
    root = []
    bumpRevision()
  }

  return {
    get revision() {
      return revisionSignal.value
    },
    getRoot() {
      void revisionSignal.value

      return root
    },
    setRoot,
    replaceSubtree,
    dispose,
  }
}

/**
 * 设置节点的父指针。
 *
 * @param nodes - 节点数组
 * @param parent - 父节点
 */
function attachParent<T extends Values>(
  nodes: RuntimeNode<T>[],
  parent: RuntimeNode<T> | null
): void {
  for (const node of nodes) {
    node.parent = parent
  }
}

/**
 * 释放被移除的节点。
 *
 * 对比前后节点列表，释放在新列表中不存在的旧节点。
 *
 * @param previous - 旧节点列表
 * @param next - 新节点列表
 */
function disposeRemoved<T extends Values>(
  previous: RuntimeNode<T>[],
  next: RuntimeNode<T>[]
): void {
  const nextSet = new Set(next)

  for (const node of previous) {
    if (!nextSet.has(node) && !node.disposed.value) {
      node.dispose()
    }
  }
}
