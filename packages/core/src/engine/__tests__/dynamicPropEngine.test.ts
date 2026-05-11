import { describe, expect, it, vi } from "vitest"

import { createFieldRuntime } from "../../field"
import { createSignal } from "../../reactivity"
import { createDisposeBag } from "../../runtime/disposeBag"
import { createRuntimeScheduler } from "../../scheduler"
import { createDynamicPropResolver } from "../dynamicPropEngine"

import type { FieldRuntimeNode } from "../../runtime"

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })

  return { promise, resolve }
}

describe("createDynamicPropResolver", () => {
  it("同一 batch 内按字段 key 去重，只应用最后一次动态属性解析", async () => {
    const scheduler = createRuntimeScheduler()
    const effectRuns: Array<() => void> = []
    const onFieldUpdate = vi.fn()
    const onTreeChange = vi.fn()
    const schema = {
      componentType: "input",
      name: "target",
      label: "Target",
      dependencies: {
        triggerFields: ["mode"],
        placeholder: (values: { mode: string }) => `mode:${values.mode}`,
      },
    } as any
    const disposeBag = createDisposeBag()
    const node: FieldRuntimeNode<{ mode: string }> = {
      id: 1,
      key: "field:target",
      type: "field",
      schema,
      parent: null,
      mounted: true,
      dirty: false,
      disposed: createSignal(false),
      disposeBag,
      onDispose: disposeBag.onDispose,
      disposeSelf: () => disposeBag.flush(),
      fieldRuntime: createFieldRuntime(schema),
      dispose: () => {},
    }
    let values = { mode: "initial" }

    const resolver = createDynamicPropResolver(node, {
      form: {
        effect: (fn: () => void) => {
          effectRuns.push(fn)
          fn()

          return vi.fn()
        },
        getFieldValue: (path: string) => values[path as "mode"],
        getFieldsSnapshot: () => values,
      } as any,
      resolveDefaults: () => ({}),
      onPendingChange: vi.fn(),
      scheduler,
      onFieldUpdate,
      onTreeChange,
    })

    values = { mode: "first" }
    effectRuns[0]()
    values = { mode: "latest" }
    effectRuns[0]()

    await scheduler.flush()

    expect(node.fieldRuntime.placeholder.value).toBe("mode:latest")
    expect(onFieldUpdate).toHaveBeenCalledTimes(1)
    expect(onTreeChange).toHaveBeenCalledTimes(1)

    resolver.dispose()
  })

  it("晚返回的旧 componentProps 结果不会覆盖后触发的新结果", async () => {
    const scheduler = createRuntimeScheduler()
    const effectRuns: Array<() => void> = []
    const slow = createDeferred<Record<string, string>>()
    const fast = createDeferred<Record<string, string>>()
    const schema = {
      componentType: "input",
      name: "target",
      label: "Target",
      dependencies: {
        triggerFields: ["mode"],
        componentProps: (values: { mode: string }) => {
          if (values.mode === "slow") return slow.promise
          if (values.mode === "fast") return fast.promise

          return { tag: values.mode }
        },
      },
    } as any
    const disposeBag = createDisposeBag()
    const node: FieldRuntimeNode<{ mode: string }> = {
      id: 1,
      key: "field:target",
      type: "field",
      schema,
      parent: null,
      mounted: true,
      dirty: false,
      disposed: createSignal(false),
      disposeBag,
      onDispose: disposeBag.onDispose,
      disposeSelf: () => disposeBag.flush(),
      fieldRuntime: createFieldRuntime(schema),
      dispose: () => {},
    }
    let values = { mode: "initial" }

    const resolver = createDynamicPropResolver(node, {
      form: {
        effect: (fn: () => void) => {
          effectRuns.push(fn)
          fn()

          return vi.fn()
        },
        getFieldValue: (path: string) => values[path as "mode"],
        getFieldsSnapshot: () => values,
      } as any,
      resolveDefaults: () => ({}),
      onPendingChange: vi.fn(),
      scheduler,
      onFieldUpdate: vi.fn(),
      onTreeChange: vi.fn(),
    })

    await scheduler.flush()

    values = { mode: "slow" }
    effectRuns[0]()
    const slowFlush = scheduler.flush()

    await Promise.resolve()

    values = { mode: "fast" }
    effectRuns[0]()
    fast.resolve({ tag: "fast" })
    slow.resolve({ tag: "slow" })

    await slowFlush

    await vi.waitFor(() => {
      expect(node.fieldRuntime.componentProps.value.value).toEqual({ tag: "fast" })
    })

    resolver.dispose()
  })
})
