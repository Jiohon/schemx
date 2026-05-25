import { describe, expect, it } from "vitest"

import {
  batchUpdates,
  createReactiveEffect,
  createSignal,
  ReactiveMap,
} from "../index"

describe("ReactiveMap", () => {
  it("reads and writes keyed values", () => {
    const map = new ReactiveMap<string, unknown>()

    map.set("name", "Alice")

    expect(map.get("name")).toBe("Alice")
    expect(map.peek("name")).toBe("Alice")
    expect(map.has("name")).toBe(true)
  })

  it("supports fluent set chaining", () => {
    const map = new ReactiveMap<string, number>()

    const returned = map.set("count", 1).set("count", 2)

    expect(returned).toBe(map)
    expect(map.get("count")).toBe(2)
  })

  it("deletes and clears values", () => {
    const map = new ReactiveMap<string, number>()

    map.set("a", 1)
    map.set("b", 2)
    expect(map.delete("a")).toBe(true)
    expect(map.delete("missing")).toBe(false)

    expect(map.get("a")).toBeUndefined()
    expect(map.has("a")).toBe(false)

    map.clear()

    expect(map.get("b")).toBeUndefined()
    expect([...map.keys()]).toEqual([])
  })

  it("iterates keys, values, and entries like Map", () => {
    const map = new ReactiveMap<string, number>()

    map.set("a", 1)
    map.set("b", 2)

    expect([...map.keys()]).toEqual(["a", "b"])
    expect([...map.values()]).toEqual([1, 2])
    expect([...map.entries()]).toEqual([
      ["a", 1],
      ["b", 2],
    ])
  })

  it("tracks keys that are created after an effect reads them", () => {
    const map = new ReactiveMap<string, unknown>()
    let runs = 0
    let latest: unknown

    const dispose = createReactiveEffect(() => {
      latest = map.get("late")
      runs++
    })

    expect(runs).toBe(1)
    expect(latest).toBeUndefined()

    map.set("late", "value")

    expect(runs).toBe(2)
    expect(latest).toBe("value")

    dispose()
  })

  it("batches multiple reactive writes", () => {
    const map = new ReactiveMap<string, number>()
    map.set("count", 0)

    let runs = 0
    let isFirst = true

    const dispose = createReactiveEffect(() => {
      map.get("count")
      if (isFirst) {
        isFirst = false

        return
      }

      runs++
    })

    batchUpdates(() => {
      map.set("count", 1)
      map.set("count", 2)
    })

    expect(runs).toBe(1)

    dispose()
  })

  it("notifies subscribers when a key is deleted", () => {
    const map = new ReactiveMap<string, number>()
    map.set("count", 0)

    let runs = 0
    let latest: number | undefined

    const dispose = createReactiveEffect(() => {
      latest = map.get("count")
      runs++
    })

    expect(runs).toBe(1)
    expect(latest).toBe(0)

    map.delete("count")

    expect(runs).toBe(2)
    expect(latest).toBeUndefined()

    dispose()
  })
})

describe("reactivity runtime", () => {
  it("creates signals and batches updates", () => {
    const count = createSignal(0)
    const seen: number[] = []

    const map = new ReactiveMap<string, number>()
    map.set("count", count.value)
    const dispose = createReactiveEffect(() => {
      seen.push(map.get("count") ?? 0)
    })

    batchUpdates(() => {
      count.value = 1
      map.set("count", count.value)
      count.value = 2
      map.set("count", count.value)
    })

    expect(seen).toEqual([0, 2])

    dispose()
  })
})
