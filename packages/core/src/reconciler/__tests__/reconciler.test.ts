import { describe, expect, it, vi } from "vitest"

import {
  commitReconcilePlan,
  createReconcilePlan,
  createReconciler,
} from "../index"

import type { FormDescriptor } from "../../descriptor"
import type {
  ContainerRuntimeNode,
  DescribedRuntimeNode,
  RuntimeNode,
  Scope,
} from "../../node"

describe("reconciler plan", () => {
  it("只根据入参计算 create/update/remove 和下一轮 children 顺序", () => {
    const reused = createNode(1, "name", "field")
    const removed = createNode(2, "age", "field")
    const previousDescriptor = createDescriptor("field", "name")
    const nextDescriptor = createDescriptor("field", "name")
    const createdDescriptor = createDescriptor("field", "email")
    const removedDescriptor = createDescriptor("field", "age")
    const currentDescriptors = new Map([
      [reused.id, previousDescriptor],
      [removed.id, removedDescriptor],
    ])

    const plan = createReconcilePlan(
      [reused, removed],
      [createdDescriptor, nextDescriptor],
      currentDescriptors
    )

    expect(plan.creates).toEqual([{ descriptor: createdDescriptor }])
    expect(plan.updates).toEqual([
      {
        node: reused,
        previousDescriptor,
        nextDescriptor,
      },
    ])
    expect(plan.removes).toEqual([{ node: removed }])
    expect(plan.nextChildrenOrder.map((entry) => entry.descriptor.key)).toEqual([
      "email",
      "name",
    ])
    expect(plan.nextChildrenOrder[0].node).toBeUndefined()
    expect(plan.nextChildrenOrder[1].node).toBe(reused)
    expect(currentDescriptors.get(reused.id)).toBe(previousDescriptor)
  })

  it("descriptor 引用未变化时不产生 update 操作", () => {
    const reused = createNode(1, "name", "field")
    const descriptor = createDescriptor("field", "name")

    const plan = createReconcilePlan(
      [reused],
      [descriptor],
      new Map([[reused.id, descriptor]])
    )

    expect(plan.creates).toEqual([])
    expect(plan.updates).toEqual([])
    expect(plan.removes).toEqual([])
    expect(plan.nextChildrenOrder[0]).toEqual({ descriptor, node: reused })
  })
})

describe("reconciler commit", () => {
  it("按 plan 调用 tree manager 和 lifecycle，不直接操作资源表", () => {
    const calls: string[] = []
    const parent = createRoot()
    const reused = createNode(1, "name", "field")
    const removed = createNode(2, "age", "field")
    const created = createNode(3, "email", "field")
    const previousDescriptor = createDescriptor("field", "name")
    const nextDescriptor = createDescriptor("field", "name")
    const createdDescriptor = createDescriptor("field", "email")

    const plan = createReconcilePlan(
      [reused, removed],
      [createdDescriptor, nextDescriptor],
      new Map([
        [reused.id, previousDescriptor],
        [removed.id, createDescriptor("field", "age")],
      ])
    )

    const nodeManager = {
      createNode: vi.fn(() => {
        calls.push("create:email")
        return created
      }),
      replaceChildren: vi.fn(() => {
        calls.push("replace")
      }),
      removeSubtree: vi.fn((node: RuntimeNode) => {
        calls.push(`remove:${node.key}`)
      }),
    }
    const lifecycle = {
      mount: vi.fn((node: DescribedRuntimeNode, descriptor: FormDescriptor) => {
        calls.push(`mount:${node.key}:${descriptor.key}`)
      }),
      update: vi.fn(
        (
          node: DescribedRuntimeNode,
          previous: FormDescriptor | undefined,
          next: FormDescriptor
        ) => {
          calls.push(`update:${node.key}:${previous?.key ?? "none"}:${next.key}`)
        }
      ),
      unmountSubtree: vi.fn((node: RuntimeNode) => {
        calls.push(`unmount:${node.key}`)
      }),
    }

    const nextChildren = commitReconcilePlan(parent, plan, {
      nodeManager,
      lifecycle,
    })

    expect(nodeManager.createNode).toHaveBeenCalledWith({
      type: "field",
      key: "email",
      scope: childScope,
    })
    expect(nodeManager.replaceChildren).toHaveBeenCalledWith(parent, [
      created,
      reused,
    ])
    expect(lifecycle.update).toHaveBeenCalledWith(
      reused,
      previousDescriptor,
      nextDescriptor
    )
    expect(lifecycle.mount).toHaveBeenCalledWith(created, createdDescriptor)
    expect(lifecycle.unmountSubtree).toHaveBeenCalledWith(removed)
    expect(nodeManager.removeSubtree).toHaveBeenCalledWith(removed)
    expect(nextChildren).toEqual([created, reused])
    expect(calls).toEqual([
      "create:email",
      "update:name:name:name",
      "mount:email:email",
      "replace",
      "unmount:age",
      "remove:age",
    ])
  })
})

describe("createReconciler", () => {
  it("组合 plan 和 commit，并在提交后递归处理 group children", () => {
    const root = createRoot()
    const group = createNode(1, "profile", "group")
    const child = createNode(2, "name", "field")
    const childDescriptor = createDescriptor("field", "name")
    const groupDescriptor = createDescriptor("group", "profile", [childDescriptor])
    const calls: string[] = []

    const nodeManager = {
      createNode: vi.fn(({ key }) => {
        calls.push(`create:${key}`)
        return key === "profile" ? group : child
      }),
      replaceChildren: vi.fn((parent: ContainerRuntimeNode, children) => {
        calls.push(`replace:${parent.key}:${children.map((node) => node.key).join(",")}`)
        parent.childNodes = [...children]
      }),
      removeSubtree: vi.fn(),
    }
    const lifecycle = {
      mount: vi.fn((node: DescribedRuntimeNode) => {
        calls.push(`mount:${node.key}`)
      }),
      update: vi.fn(),
      unmountSubtree: vi.fn(),
    }
    const reconciler = createReconciler({
      nodeManager,
      lifecycle,
      getCurrentDescriptors: () => new Map(),
    })

    reconciler.reconcileChildren(root, [groupDescriptor])

    expect(root.childNodes).toEqual([group])
    expect(group.childNodes).toEqual([child])
    expect(calls).toEqual([
      "create:profile",
      "mount:profile",
      "replace:root:profile",
      "create:name",
      "mount:name",
      "replace:profile:name",
    ])
  })
})

const childScope = createScope()

function createRoot(): ContainerRuntimeNode {
  return {
    id: 0,
    key: "root",
    type: "root",
    parent: null,
    scope: createScope(childScope),
    mounted: { value: false },
    disposed: { value: false },
    childNodes: [],
  } as ContainerRuntimeNode
}

function createNode(
  id: number,
  key: string,
  type: "field" | "group" | "dependency"
): DescribedRuntimeNode {
  const node = {
    id,
    key,
    type,
    parent: null,
    scope: createScope(),
    mounted: { value: false },
    disposed: { value: false },
  }

  if (type === "field") {
    return node as DescribedRuntimeNode
  }

  return {
    ...node,
    childNodes: [],
  } as DescribedRuntimeNode
}

function createDescriptor(
  type: "field" | "group" | "dependency",
  key: string,
  children: FormDescriptor[] = []
): FormDescriptor {
  if (type === "group") {
    return {
      type,
      key,
      staticSchema: {},
      children,
    } as FormDescriptor
  }

  if (type === "dependency") {
    return {
      type,
      key,
      triggerFields: [],
      renderer: () => [],
    } as FormDescriptor
  }

  return {
    type,
    key,
    name: key,
    componentType: "text",
    staticSchema: {},
  } as FormDescriptor
}

function createScope(child?: Scope): Scope {
  return {
    disposed: false,
    add: vi.fn(),
    child: vi.fn(() => child ?? createScope()),
    dispose: vi.fn(),
  }
}
