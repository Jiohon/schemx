/**
 * SignalMap 属性测试（Property-Based Testing）
 *
 * 使用 fast-check 验证 SignalMap 核心数据操作的正确性属性。
 * 每个属性测试至少运行 100 次迭代。
 *
 * @module core/__tests__/signalMap
 */

import { describe, expect, it } from "vitest"
import fc from "fast-check"

import { SignalMap } from ".."

describe("SignalMap 属性测试", () => {
  // Feature: pure-signal-core-refactor, Property 1: SignalMap get/set 往返一致性
  // **Validates: Requirements 1.2**
  it("Property 1: 对任意 key 和值，set 后 get/peek 应返回相等的值", () => {
    fc.assert(
      fc.property(fc.string(), fc.anything(), (key, value) => {
        const map = new SignalMap<string, unknown>()
        map.set(key, value)
        expect(map.get(key)).toEqual(value)
        expect(map.peek(key)).toEqual(value)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: signal-map-abstraction, Property 2: peek/get 值一致性
  // **Validates: Requirements 1.3**
  it("Property 2: 对任意已存在的 key，peek 和 get 返回相同值", () => {
    fc.assert(
      fc.property(fc.string(), fc.anything(), (key, value) => {
        const map = new SignalMap<string, unknown>()
        map.set(key, value)
        expect(map.peek(key)).toEqual(map.get(key))
      }),
      { numRuns: 100 }
    )
  })

  // Feature: signal-map-abstraction, Property 3: update 等价性
  // **Validates: Requirements 1.4, 1.16**
  it("Property 3: update(K, updater) 后 get(K) 等于 updater(原始值)", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), fc.integer(), (key, initial, delta) => {
        const map = new SignalMap<string, number>()
        map.set(key, initial)

        const originalValue = map.peek(key)!
        const updater = (prev: number) => prev + delta

        map.update(key, updater)
        expect(map.get(key)).toEqual(updater(originalValue))
      }),
      { numRuns: 100 }
    )
  })

  // Feature: signal-map-abstraction, Property 4: has/set/delete 一致性
  // **Validates: Requirements 1.5, 1.7**
  it("Property 4: set 后 has 为 true，delete 后 has 为 false 且 get 返回 undefined", () => {
    fc.assert(
      fc.property(fc.string(), fc.anything(), (key, value) => {
        const map = new SignalMap<string, unknown>()

        // set 后 has 应为 true
        map.set(key, value)
        expect(map.has(key)).toBe(true)

        // delete 后 has 应为 false，get 应返回 undefined
        map.delete(key)
        expect(map.has(key)).toBe(false)
        expect(map.get(key)).toBeUndefined()
      }),
      { numRuns: 100 }
    )
  })

  // Feature: signal-map-abstraction, Property 5: clear 清空所有条目
  // **Validates: Requirements 1.8**
  it("Property 5: clear 后所有 key 的 has 返回 false，get 返回 undefined", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.string(), fc.anything()), { minLength: 1, maxLength: 20 }),
        (entries) => {
          const map = new SignalMap<string, unknown>()
          const keys: string[] = []

          // 写入所有条目
          for (const [key, value] of entries) {
            map.set(key, value)
            keys.push(key)
          }

          // 清空
          map.clear()

          // 验证所有 key 均已清空
          for (const key of keys) {
            expect(map.has(key)).toBe(false)
            expect(map.get(key)).toBeUndefined()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: signal-map-abstraction, Property 6: getSnapshot 与逐 key peek 一致性
  // **Validates: Requirements 1.9, 1.10**
  it("Property 6: getSnapshot 与遍历 keys+peek 构建的 Map 相等", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.string(), fc.anything()), { minLength: 0, maxLength: 20 }),
        (entries) => {
          const map = new SignalMap<string, unknown>()

          for (const [key, value] of entries) {
            map.set(key, value)
          }

          // 通过 getSnapshot 获取快照
          const snapshot = map.getSnapshot()

          // 通过遍历 keys + peek 手动构建 Map
          const manual = new Map<string, unknown>()
          for (const key of map.keys()) {
            manual.set(key, map.peek(key))
          }

          // 两者应完全相等
          expect(snapshot).toEqual(manual)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe("SignalMap 生命周期属性测试", () => {
  // Feature: pure-signal-core-refactor, Property 3: effect 追踪新 key 创建（version signal）
  // **Validates: Requirements 1.3**
  it("Property 3: effect 内 get 不存在的 key 后，set 该 key 应触发 effect 重新执行并读取到新值", () => {
    fc.assert(
      fc.property(fc.string(), fc.anything(), (key, value) => {
        const map = new SignalMap<string, unknown>()

        // 记录 effect 执行次数和最后读取到的值
        let effectRunCount = 0
        let lastReadValue: unknown = undefined

        map.effect(() => {
          // 读取不存在（或后续已存在）的 key，建立 version signal 依赖
          lastReadValue = map.get(key)
          effectRunCount++
        })

        // effect 首次执行：key 不存在，读取到 undefined
        expect(effectRunCount).toBe(1)
        expect(lastReadValue).toBeUndefined()

        // 创建该 key，应触发 effect 重新执行
        map.set(key, value)

        // effect 应被重新执行，且能读取到新值
        expect(effectRunCount).toBe(2)
        expect(lastReadValue).toEqual(value)

        map.destroy()
      }),
      { numRuns: 100 }
    )
  })

  // Feature: signal-map-abstraction, Property 9: batch 合并 effect 触发
  // **Validates: Requirements 1.12**
  it("Property 9: batch 内多次 set，effect 只触发一次", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.array(fc.integer(), { minLength: 2, maxLength: 10 }),
        (key, values) => {
          const map = new SignalMap<string, number>()
          map.set(key, 0)

          // 使用计数器追踪 effect 触发次数（首次执行不计入）
          let effectCount = 0
          let isFirst = true

          map.effect(() => {
            map.get(key) // 收集依赖
            if (isFirst) {
              isFirst = false
              return
            }
            effectCount++
          })

          // 在 batch 内执行多次 set
          map.batch(() => {
            for (const v of values) {
              map.set(key, v)
            }
          })

          // effect 应只触发一次
          expect(effectCount).toBe(1)

          map.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pure-signal-core-refactor, Property 4: destroy 清理所有 effect
  // **Validates: Requirements 1.4**
  it("Property 4: 对于任意数量的 effect，destroy 后 set 不应触发任何已创建的 effect 回调", () => {
    fc.assert(
      fc.property(
        // 生成 1-6 个 effect
        fc.nat({ max: 5 }),
        fc.string(),
        fc.anything(),
        (effectCount, key, value) => {
          const numEffects = effectCount + 1 // 确保至少 1 个 effect
          const map = new SignalMap<string, unknown>()

          // 先写入初始值，确保 effect 能建立依赖
          map.set(key, "initial")

          // 记录每个 effect 在 destroy 后的触发次数
          const postDestroyCallCounts: number[] = Array.from(
            { length: numEffects },
            () => 0
          )
          // 标记是否已 destroy
          let destroyed = false

          // 创建多个 effect，每个都追踪同一个 key
          for (let i = 0; i < numEffects; i++) {
            const idx = i
            map.effect(() => {
              map.get(key) // 收集依赖
              if (destroyed) {
                postDestroyCallCounts[idx]++
              }
            })
          }

          // 销毁 SignalMap
          destroyed = true
          map.destroy()

          // destroy 后 set 值（destroy 清空了 signals，所以会创建新 signal）
          map.set(key, value)

          // 所有 effect 在 destroy 后都不应被触发
          for (let i = 0; i < numEffects; i++) {
            expect(postDestroyCallCounts[i]).toBe(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: signal-map-abstraction, Property 10: destroy 停止所有 effect
  // **Validates: Requirements 1.13, 1.18**
  it("Property 10: destroy 后 set 不触发任何 effect", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer(), fc.integer(), (key, initial, newValue) => {
        const map = new SignalMap<string, number>()
        map.set(key, initial)

        let effectCallCount = 0

        // 创建 effect 监听（首次执行不计入）
        let isFirst = true
        map.effect(() => {
          map.get(key) // 收集依赖
          if (isFirst) {
            isFirst = false
            return
          }
          effectCallCount++
        })

        // 销毁 SignalMap
        map.destroy()

        // destroy 后重新创建 signal 并 set 值（因为 destroy 清空了 signals）
        map.set(key, newValue)

        // effect 不应被触发
        expect(effectCallCount).toBe(0)
      }),
      { numRuns: 100 }
    )
  })
})

describe("SignalMap 边界情况单元测试", () => {
  describe("key 不存在时的行为", () => {
    it("get 返回 undefined", () => {
      const map = new SignalMap<string, number>()
      expect(map.get("nonexistent")).toBeUndefined()
    })

    it("peek 返回 undefined", () => {
      const map = new SignalMap<string, number>()
      expect(map.peek("nonexistent")).toBeUndefined()
    })

    it("delete 静默忽略", () => {
      const map = new SignalMap<string, number>()
      expect(() => map.delete("nonexistent")).not.toThrow()
    })

    it("has 返回 false", () => {
      const map = new SignalMap<string, number>()
      expect(map.has("nonexistent")).toBe(false)
    })
  })

  describe("destroy 后的行为", () => {
    it("destroy 后 get 返回 undefined", () => {
      const map = new SignalMap<string, number>()
      map.set("a", 1)
      map.destroy()
      expect(map.get("a")).toBeUndefined()
    })

    it("destroy 后 has 返回 false", () => {
      const map = new SignalMap<string, number>()
      map.set("a", 1)
      map.destroy()
      expect(map.has("a")).toBe(false)
    })

    it("destroy 后 set 可正常创建新 signal", () => {
      const map = new SignalMap<string, number>()
      map.set("a", 1)
      map.destroy()
      map.set("b", 2)
      expect(map.get("b")).toBe(2)
    })

    it("destroy 后 keys 返回空迭代器", () => {
      const map = new SignalMap<string, number>()
      map.set("a", 1)
      map.destroy()
      expect([...map.keys()]).toEqual([])
    })

    it("destroy 后 getSnapshot 返回空 Map", () => {
      const map = new SignalMap<string, number>()
      map.set("a", 1)
      map.destroy()
      expect(map.getSnapshot().size).toBe(0)
    })

    it("多次 destroy 不抛错", () => {
      const map = new SignalMap<string, number>()
      map.set("a", 1)
      map.destroy()
      expect(() => map.destroy()).not.toThrow()
    })
  })
})
