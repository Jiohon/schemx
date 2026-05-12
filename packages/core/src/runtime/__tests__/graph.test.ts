import { describe, expect, it, vi } from "vitest"

import { createSignal } from "../../reactivity"
import { createDisposeBag } from "../disposeBag"
import { createRuntimeGraph } from "../graph"

import type { DependencyRuntimeNode, FieldRuntimeNode, RuntimeNode } from "../../types"

function createFieldNode(key: string): FieldRuntimeNode {
  const disposeBag = createDisposeBag()

  return {
    id: Math.random(),
    key,
    type: "field",
    schema: { componentType: "input", name: key, label: key } as any,
    parent: null,
    mounted: true,
    dirty: false,
    disposed: createSignal(false),
    disposeBag,
    onDispose: disposeBag.onDispose,
    disposeSelf: () => disposeBag.flush(),
    fieldRuntime: {} as any,
    dispose: vi.fn(function (this: RuntimeNode) {
      this.disposed.value = true
    }),
  }
}

function createDependencyNode(key: string): DependencyRuntimeNode {
  const disposeBag = createDisposeBag()

  return {
    id: Math.random(),
    key,
    type: "dependency",
    schema: {
      componentType: "dependency",
      to: ["type"],
      renderer: () => [],
    } as any,
    parent: null,
    children: [],
    mounted: true,
    dirty: false,
    disposed: createSignal(false),
    disposeBag,
    onDispose: disposeBag.onDispose,
    disposeSelf: () => disposeBag.flush(),
    dependencyRuntime: {
      subtree: createSignal<RuntimeNode[]>([]),
      loading: createSignal(false),
      error: createSignal(null),
      version: 0,
      abortController: null,
      run: async () => {},
    },
    dispose: vi.fn(function (this: RuntimeNode) {
      this.disposed.value = true
    }),
  }
}

describe("createRuntimeGraph", () => {
  it("替换 dependency subtree 时释放被移除节点，保留复用节点并递增 revision", () => {
    const graph = createRuntimeGraph()
    const owner = createDependencyNode("dependency")
    const stale = createFieldNode("stale")
    const reused = createFieldNode("reused")
    const created = createFieldNode("created")

    graph.setRoot([owner])
    graph.replaceSubtree(owner, [stale, reused])

    const revision = graph.revision

    graph.replaceSubtree(owner, [reused, created])

    expect(stale.dispose).toHaveBeenCalledTimes(1)
    expect(reused.dispose).not.toHaveBeenCalled()
    expect(owner.children).toEqual([reused, created])
    expect(owner.dependencyRuntime.subtree.value).toEqual([reused, created])
    expect(reused.parent).toBe(owner)
    expect(created.parent).toBe(owner)
    expect(graph.revision).toBe(revision + 1)
  })

  it("dispose 会释放 root subtree 并清空 root", () => {
    const graph = createRuntimeGraph()
    const first = createFieldNode("first")
    const second = createFieldNode("second")

    graph.setRoot([first, second])
    graph.dispose()

    expect(first.dispose).toHaveBeenCalledTimes(1)
    expect(second.dispose).toHaveBeenCalledTimes(1)
    expect(graph.getRoot()).toEqual([])
  })
})
