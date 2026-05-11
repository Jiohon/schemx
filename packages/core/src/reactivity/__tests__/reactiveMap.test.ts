import { describe, expect, it } from "vitest"

import { batchUpdates, createSignal, ReactiveMap } from "../index"

describe("ReactiveMap", () => {
  it("reads and writes keyed values", () => {
    const map = new ReactiveMap<string, unknown>()

    map.set("name", "Alice")

    expect(map.get("name")).toBe("Alice")
    expect(map.peek("name")).toBe("Alice")
    expect(map.has("name")).toBe(true)
  })

  it("updates values from the current snapshot", () => {
    const map = new ReactiveMap<string, number>()

    map.set("count", 1)
    map.update("count", (prev) => prev + 1)

    expect(map.get("count")).toBe(2)
  })

  it("deletes and clears values", () => {
    const map = new ReactiveMap<string, number>()

    map.set("a", 1)
    map.set("b", 2)
    map.delete("a")

    expect(map.get("a")).toBeUndefined()
    expect(map.has("a")).toBe(false)

    map.clear()

    expect(map.get("b")).toBeUndefined()
    expect([...map.keys()]).toEqual([])
  })

  it("returns a non-tracking snapshot", () => {
    const map = new ReactiveMap<string, number>()

    map.set("a", 1)
    map.set("b", 2)

    expect(map.getSnapshot()).toEqual(
      new Map<string, number>([
        ["a", 1],
        ["b", 2],
      ])
    )
  })

  it("tracks keys that are created after an effect reads them", () => {
    const map = new ReactiveMap<string, unknown>()
    let runs = 0
    let latest: unknown

    const dispose = map.effect(() => {
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

    map.effect(() => {
      map.get("count")
      if (isFirst) {
        isFirst = false

        return
      }

      runs++
    })

    map.batch(() => {
      map.set("count", 1)
      map.set("count", 2)
    })

    expect(runs).toBe(1)

    map.destroy()
  })

  it("does not run disposed effects after destroy", () => {
    const map = new ReactiveMap<string, number>()
    map.set("count", 0)

    let runs = 0

    map.effect(() => {
      map.get("count")
      runs++
    })

    expect(runs).toBe(1)

    map.destroy()
    map.set("count", 1)

    expect(runs).toBe(1)
  })
})

describe("reactivity facade", () => {
  it("creates signals and batches updates", () => {
    const count = createSignal(0)
    const seen: number[] = []

    const map = new ReactiveMap<string, number>()
    map.set("count", count.value)
    map.effect(() => {
      seen.push(map.get("count") ?? 0)
    })

    batchUpdates(() => {
      count.value = 1
      map.set("count", count.value)
      count.value = 2
      map.set("count", count.value)
    })

    expect(seen).toEqual([0, 2])

    map.destroy()
  })
})
