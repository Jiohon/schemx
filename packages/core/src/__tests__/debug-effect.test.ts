import { describe, it, expect } from "vitest"
import { signal, effect } from "@preact/signals-core"
import { SignalMap } from "../signalMap"
import { createFormStore } from "../store"
import { createFormInstance } from "../createForm"

describe("debug: signal effect 追踪", () => {
  it("原始 signal: effect 应在值变化后重新执行", () => {
    const s = signal("init")
    let count = 0
    let lastValue: any

    const dispose = effect(() => {
      lastValue = s.value
      count++
    })

    expect(count).toBe(1)
    expect(lastValue).toBe("init")

    s.value = "hello"
    expect(count).toBe(2)
    expect(lastValue).toBe("hello")

    dispose()
  })

  it("SignalMap.get: effect 应在 set 后重新执行", () => {
    const map = new SignalMap<string, any>()
    map.set("name", "init")

    let count = 0
    let lastValue: any

    const dispose = effect(() => {
      lastValue = map.get("name")
      count++
    })

    expect(count).toBe(1)
    expect(lastValue).toBe("init")

    map.set("name", "hello")
    expect(count).toBe(2)
    expect(lastValue).toBe("hello")

    dispose()
  })

  it("FormStore.getFieldValue: effect 应在 setFieldValue 后重新执行", () => {
    const store = createFormStore({ initialValues: { name: "init", age: 0 } })

    let count = 0
    let lastValue: any

    const dispose = effect(() => {
      lastValue = store.getFieldValue("name")
      count++
    })

    expect(count).toBe(1)
    expect(lastValue).toBe("init")

    store.setFieldValue("name", "hello")
    expect(count).toBe(2)
    expect(lastValue).toBe("hello")

    dispose()
  })

  it("createFormInstance: effect 应在 setFieldValue 后重新执行", () => {
    const form = createFormInstance({ initialValues: { name: "init", age: 0 } })

    let count = 0
    let lastValue: any

    const dispose = effect(() => {
      lastValue = form.getFieldValue("name")
      count++
    })

    expect(count).toBe(1)
    expect(lastValue).toBe("init")

    form.setFieldValue("name", "hello")
    expect(count).toBe(2)
    expect(lastValue).toBe("hello")

    dispose()
  })
})
