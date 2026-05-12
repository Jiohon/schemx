import { describe, expect, it } from "vitest"

import { createFieldRuntime } from "../fieldProps"
import { createFieldLifecycle } from "../fieldLifecycle"
import { createSignal } from "../../reactivity"
import { createDisposeBag } from "../../runtime/disposeBag"

import type { FieldRuntimeNode } from "../../runtime"

describe("fieldLifecycle", () => {
  it("按事件类型派发 field lifecycle event，并携带 resolved props", () => {
    const lifecycle = createFieldLifecycle()
    const disposeBag = createDisposeBag()
    const node: FieldRuntimeNode = {
      id: 1,
      key: "root/field:name",
      type: "field",
      schema: {
        componentType: "input",
        name: "name",
        label: "Name",
        disabled: true,
      } as any,
      parent: null,
      mounted: true,
      dirty: false,
      disposed: createSignal(false),
      disposeBag,
      onDispose: disposeBag.onDispose,
      disposeSelf: () => disposeBag.flush(),
      fieldRuntime: createFieldRuntime({
        componentType: "input",
        name: "name",
        label: "Name",
        disabled: true,
      } as any),
      dispose: () => {},
    }
    const events: string[] = []
    const dispose = lifecycle.on("mount", (event) => {
      events.push(`${event.type}:${event.node.key}:${event.props.disabled}`)
    })

    lifecycle.emitNode("mount", node)
    dispose()
    lifecycle.emitNode("mount", node)

    expect(events).toEqual(["mount:root/field:name:true"])
  })
})
