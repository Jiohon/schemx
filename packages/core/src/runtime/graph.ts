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
} from "./types"
import type { Values } from "../types"

export interface RuntimeGraph<T extends Values = Values> {
  readonly revision: number
  getRoot: () => RuntimeNode<T>[]
  setRoot: (nodes: RuntimeNode<T>[]) => void
  replaceSubtree: (
    owner: DependencyRuntimeNode<T> | GroupRuntimeNode<T>,
    nextChildren: RuntimeNode<T>[]
  ) => void
  dispose: () => void
}

export function createRuntimeGraph<T extends Values = Values>(): RuntimeGraph<T> {
  const revisionSignal = createSignal(0)
  let root: RuntimeNode<T>[] = []

  const bumpRevision = (): void => {
    revisionSignal.value += 1
  }

  const setRoot = (nodes: RuntimeNode<T>[]): void => {
    disposeRemoved(root, nodes)
    root = nodes
    attachParent(root, null)
    bumpRevision()
  }

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

function attachParent<T extends Values>(
  nodes: RuntimeNode<T>[],
  parent: RuntimeNode<T> | null
): void {
  for (const node of nodes) {
    node.parent = parent
  }
}

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
