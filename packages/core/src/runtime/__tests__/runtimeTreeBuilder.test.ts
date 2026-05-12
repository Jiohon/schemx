import { describe, expect, it, vi } from "vitest"

import { createRuntimeScheduler } from "../../scheduler"
import { RuntimeTreeBuilder } from "../runtimeTreeBuilder"

import type { FormRuntimeContext } from "../context"
import type { RuntimeNode, Values } from "../../types"

function createBuilder<T extends Values = Values>(
  lifecycle: Partial<FormRuntimeContext<T>> = {}
): RuntimeTreeBuilder<T> {
  const scheduler = createRuntimeScheduler()

  return new RuntimeTreeBuilder<T>({
    context: {
      form: {} as FormRuntimeContext<T>["form"],
      resolveFieldDefaults: () => ({}),
      ...lifecycle,
    },
    scheduler,
    commitDependencySubtree: () => {},
    onTreeChange: () => {},
  })
}

describe("RuntimeTreeBuilder lifecycle", () => {
  it("creates field nodes with disposed signal and onDispose callback", () => {
    const onFieldMount = vi.fn()
    const onFieldUnmount = vi.fn()
    const builder = createBuilder({
      onFieldMount,
      onFieldUnmount,
    })
    const node = (builder as any).createFieldNode(
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
    const builder = createBuilder()
    const group = (builder as any).createGroupNode(
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
