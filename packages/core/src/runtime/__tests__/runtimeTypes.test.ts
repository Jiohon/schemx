import { describe, expect, expectTypeOf, it } from "vitest"

import { createSignal } from "../../reactivity"
import {
  DependencyRuntimeNode,
  FieldRuntimeNode,
  hasChildren,
  isDependencyRuntimeNode,
  isFieldRuntimeNode,
  isGroupRuntimeNode,
  ReactiveComputation,
  RuntimeNode,
  SchemxBaseField,
  SchemxComponentProps,
  SchemxDependencyField,
  SchemxGroupField,
  Values,
} from "../../types"
import { createDisposeBag } from "../disposeBag"

function computation<T>(value: T): ReactiveComputation<T> {
  return {
    version: 0,
    value: createSignal(value),
    abortController: null,
    dispose: () => {},
  }
}

function baseNode<T extends Values>(type: RuntimeNode<T>["type"]) {
  const disposeBag = createDisposeBag()

  return {
    type,
    id: 1,
    key: `${type}:1`,
    parent: null,
    mounted: true,
    dirty: false,
    disposed: createSignal(false),
    disposeBag,
    onDispose: disposeBag.onDispose,
    disposeSelf: () => {
      disposeBag.flush()
    },
    dispose: () => {
      disposeBag.flush()
    },
  }
}

describe("runtime node type guards", () => {
  it("narrows field runtime nodes to fieldRuntime state", () => {
    const node: RuntimeNode = {
      ...baseNode("field"),
      schema: {} as SchemxBaseField,
      fieldRuntime: {
        visible: computation(true),
        readonly: computation(false),
        disabled: computation(false),
        required: computation(false),
        placeholder: createSignal(""),
        componentProps: computation({} as SchemxComponentProps),
        rules: computation(undefined),
      },
    }

    expect(isFieldRuntimeNode(node)).toBe(true)

    if (isFieldRuntimeNode(node)) {
      expectTypeOf(node).toEqualTypeOf<FieldRuntimeNode>()
      expect(node.fieldRuntime.visible.value.value).toBe(true)
    }
  })

  it("narrows group and dependency nodes to children-bearing nodes", () => {
    const group: RuntimeNode = {
      ...baseNode("group"),
      schema: { componentType: "group", children: [] } as unknown as SchemxGroupField,
      children: [],
    }

    const dependency: RuntimeNode = {
      ...baseNode("dependency"),
      schema: {} as SchemxDependencyField,
      children: [],
      dependencyRuntime: {
        version: 0,
        abortController: null,
        loading: createSignal(false),
        error: createSignal(null),
        subtree: createSignal([]),
        run: async () => {},
      },
    }

    expect(isGroupRuntimeNode(group)).toBe(true)
    expect(isDependencyRuntimeNode(dependency)).toBe(true)
    expect(hasChildren(group)).toBe(true)
    expect(hasChildren(dependency)).toBe(true)

    if (isDependencyRuntimeNode(dependency)) {
      expectTypeOf(dependency).toEqualTypeOf<DependencyRuntimeNode>()
      expect(dependency.dependencyRuntime.loading.value).toBe(false)
    }
  })
})
