import { describe, expect, it, vi } from "vitest"

import { DependencyScheduler, createRuntimeScheduler } from "../../scheduler"
import { RuntimeNodeFactory } from "../nodeFactory"

import type { FormRuntimeContext } from "../../core"
import type { RuntimeNode } from "../types"
import type { Values } from "../../types"

function createFactory<T extends Values = Values>(
  lifecycle: Partial<FormRuntimeContext<T>> = {}
): RuntimeNodeFactory<T> {
  const runtimeScheduler = createRuntimeScheduler()
  const scheduler = new DependencyScheduler<T>(runtimeScheduler)

  return new RuntimeNodeFactory<T>({
    context: {
      form: {} as FormRuntimeContext<T>["form"],
      resolveFieldDefaults: () => ({}),
      ...lifecycle,
    },
    scheduler,
    runtimeScheduler,
    compileChildren: () => [],
    commitDependencySubtree: () => {},
    onPendingChange: () => {},
    onTreeChange: () => {},
  })
}

describe("RuntimeNodeFactory lifecycle", () => {
  it("creates field nodes with disposed signal and onDispose callback", () => {
    const onFieldMount = vi.fn()
    const onFieldUnmount = vi.fn()
    const factory = createFactory({
      onFieldMount,
      onFieldUnmount,
    })
    const node = factory.createFieldNode(
      { componentType: "input", name: "name", label: "Name" } as any,
      "root/field:name",
      null
    )
    const onDispose = vi.fn()

    node.onDispose(onDispose)

    expect(node.mounted).toBe(true)
    expect(node.disposed.value).toBe(false)
    expect(onFieldMount).toHaveBeenCalledWith(node)

    node.dispose()
    node.dispose()

    expect(node.mounted).toBe(false)
    expect(node.parent).toBe(null)
    expect(node.disposed.value).toBe(true)
    expect(onDispose).toHaveBeenCalledTimes(1)
    expect(onFieldUnmount).toHaveBeenCalledTimes(1)
  })

  it("disposes group children before the group itself", () => {
    const factory = createFactory()
    const group = factory.createGroupNode(
      { componentType: "group", children: [] } as any,
      "root/group",
      null
    )
    const childDispose = vi.fn()

    group.children = [
      {
        id: 2,
        key: "child",
        type: "field",
        schema: {} as any,
        parent: group,
        mounted: true,
        dirty: false,
        disposed: { value: false, peek: () => false },
        disposeBag: group.disposeBag,
        onDispose: group.onDispose,
        disposeSelf: () => {},
        dispose: childDispose,
        fieldRuntime: {} as any,
      } satisfies RuntimeNode,
    ]

    group.dispose()

    expect(childDispose).toHaveBeenCalledTimes(1)
    expect(group.disposed.value).toBe(true)
  })
})
