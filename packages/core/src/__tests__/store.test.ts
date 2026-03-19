/**
 * FormStore 单元测试
 *
 * 覆盖 FormStore 的所有公开 API：
 * 构造、getFieldValue、setFieldValue、getFieldsValue、setFieldsValue、
 * getFieldsSnapshot、getInitialValues、setInitialValues、
 * isFieldTouched、isFieldsTouched、getTouchedFields、reset、resetField。
 *
 * @module core/__tests__/store
 */

import { isReactive } from "vue"

import fc from "fast-check"
import { describe, expect, it } from "vitest"

import { createFormStore, FormStore } from "../store"

interface TestForm {
  name: string
  age: number
  email: string
}

interface NestedForm {
  user: {
    name: string
    address: {
      city: string
      zip: string
    }
  }
  tags: string[]
}

describe("FormStore", () => {
  describe("构造", () => {
    it("无参构造创建空 store", () => {
      const store = new FormStore()
      expect(store.getFieldsSnapshot()).toEqual({})
    })

    it("使用 initialValues 构造", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      expect(store.getFieldValue("name")).toBe("John")
      expect(store.getFieldValue("age")).toBe(25)
    })

    it("initialValues 深拷贝，外部修改不影响 store", () => {
      const init = { name: "John", age: 25, email: "j@t.com" }
      const store = new FormStore<TestForm>({ initialValues: init })
      init.name = "Modified"
      expect(store.getFieldValue("name")).toBe("John")
    })

    it("createFormStore 工厂函数", () => {
      const store = createFormStore<TestForm>({
        initialValues: { name: "A", age: 1, email: "a@b.com" },
      })
      expect(store.getFieldValue("name")).toBe("A")
    })
  })

  describe("getFieldValue / setFieldValue", () => {
    it("获取和设置基本字段", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Jane")
      expect(store.getFieldValue("name")).toBe("Jane")
    })

    it("获取和设置嵌套字段", () => {
      const store = new FormStore<NestedForm>({
        initialValues: {
          user: { name: "John", address: { city: "Beijing", zip: "100000" } },
          tags: ["a"],
        },
      })
      store.setFieldValue("user.address.city" as any, "Shanghai")
      expect(store.getFieldValue("user.address.city" as any)).toBe("Shanghai")
    })

    it("获取不存在的字段返回 undefined", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      expect(store.getFieldValue("nonexistent" as any)).toBeUndefined()
    })

    it("对象类型字段返回只读包装", () => {
      const store = new FormStore<NestedForm>({
        initialValues: {
          user: { name: "John", address: { city: "Beijing", zip: "100000" } },
          tags: ["a"],
        },
      })
      const user = store.getFieldValue("user")
      // readonly 包装的对象，值可读取
      expect((user as any).name).toBe("John")
    })
  })

  describe("getFieldsValue / setFieldsValue", () => {
    it("无参返回全量值", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      const values = store.getFieldsValue()
      expect(values).toEqual({ name: "John", age: 25, email: "j@t.com" })
    })

    it("传入路径数组返回指定字段", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      const partial = store.getFieldsValue(["name", "age"])
      expect(partial).toEqual({ name: "John", age: 25 })
    })

    it("批量设置多个字段", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldsValue({ name: "Jane", age: 30 })
      expect(store.getFieldValue("name")).toBe("Jane")
      expect(store.getFieldValue("age")).toBe(30)
      expect(store.getFieldValue("email")).toBe("j@t.com")
    })
  })

  describe("getFieldsSnapshot", () => {
    it("返回原始对象的深拷贝", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      const snap1 = store.getFieldsSnapshot()
      const snap2 = store.getFieldsSnapshot()
      expect(snap1).toEqual(snap2)
      expect(snap1).not.toBe(snap2)
    })

    it("快照不受后续修改影响", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      const snap = store.getFieldsSnapshot()
      store.setFieldValue("name", "Changed")
      expect(snap.name).toBe("John")
    })

    it("快照不是 reactive 对象", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      const snap = store.getFieldsSnapshot()
      expect(isReactive(snap)).toBe(false)
    })
  })

  describe("getInitialValues / setInitialValues", () => {
    it("无参返回全量初始值深拷贝", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      const init = store.getInitialValues()
      expect(init).toEqual({ name: "John", age: 25, email: "j@t.com" })
      // 修改返回值不影响 store
      init.name = "Modified"
      expect(store.getInitialValues().name).toBe("John")
    })

    it("传入路径数组返回指定字段初始值", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      const partial = store.getInitialValues(["name", "email"])
      expect(partial).toEqual({ name: "John", email: "j@t.com" })
    })

    it("setInitialValues 批量更新初始值", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setInitialValues({ name: "NewDefault", age: 99 })
      expect(store.getInitialValues().name).toBe("NewDefault")
      expect(store.getInitialValues().age).toBe(99)
      // 未更新的字段保持原值
      expect(store.getInitialValues().email).toBe("j@t.com")
    })

    it("setInitialValues 空对象不报错", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setInitialValues({})
      expect(store.getInitialValues()).toEqual({
        name: "John",
        age: 25,
        email: "j@t.com",
      })
    })
  })

  describe("isFieldTouched / isFieldsTouched / getTouchedFields", () => {
    it("未修改字段返回 false", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      expect(store.isFieldTouched("name")).toBe(false)
    })

    it("修改后返回 true", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Jane")
      expect(store.isFieldTouched("name")).toBe(true)
    })

    it("设回初始值后返回 false", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Jane")
      store.setFieldValue("name", "John")
      expect(store.isFieldTouched("name")).toBe(false)
    })

    it("isFieldsTouched 无参检查任一字段", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      expect(store.isFieldsTouched()).toBe(false)
      store.setFieldValue("age", 30)
      expect(store.isFieldsTouched()).toBe(true)
    })

    it("isFieldsTouched 传入路径数组检查所有字段", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Jane")
      // 只修改了 name，age 未修改
      expect(store.isFieldsTouched(["name", "age"])).toBe(false)
      store.setFieldValue("age", 30)
      expect(store.isFieldsTouched(["name", "age"])).toBe(true)
    })

    it("getTouchedFields 返回所有被修改的路径", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Jane")
      store.setFieldValue("email", "new@t.com")
      const touched = store.getTouchedFields()
      expect(touched).toContain("name")
      expect(touched).toContain("email")
      expect(touched).not.toContain("age")
    })
  })

  describe("reset / resetField", () => {
    it("reset 恢复到初始值", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Changed")
      store.setFieldValue("age", 99)
      store.reset()
      expect(store.getFieldsSnapshot()).toEqual({
        name: "John",
        age: 25,
        email: "j@t.com",
      })
    })

    it("reset 传入新值同时更新初始值", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.reset({ name: "New", age: 0, email: "new@t.com" })
      expect(store.getFieldsSnapshot()).toEqual({
        name: "New",
        age: 0,
        email: "new@t.com",
      })
      expect(store.getInitialValues()).toEqual({
        name: "New",
        age: 0,
        email: "new@t.com",
      })
    })

    it("resetField 恢复单个字段", () => {
      const store = new FormStore<TestForm>({
        initialValues: { name: "John", age: 25, email: "j@t.com" },
      })
      store.setFieldValue("name", "Changed")
      store.setFieldValue("age", 99)
      store.resetField("name")
      expect(store.getFieldValue("name")).toBe("John")
      expect(store.getFieldValue("age")).toBe(99) // age 不受影响
    })
  })
})

describe("FormStore 属性测试", () => {
  // Feature: pure-signal-core-refactor, Property 2: FormStore setFieldValue/setFieldsValue 往返一致性
  // **Validates: Requirements 3.1, 3.4**
  it("Property 2: 对任意字段路径和值，setFieldValue 后 getFieldValue 应返回相同的值；setFieldsValue 同理", () => {
    // 使用原始类型值，避免 collectObjectPathsByLeaf 将对象展开为嵌套路径
    const primitiveArb = fc.oneof(
      fc.string(),
      fc.integer(),
      fc.double({ noNaN: true }),
      fc.boolean(),
      fc.constant(null)
    )

    fc.assert(
      fc.property(
        fc
          .string()
          .filter(
            (s) =>
              s.length > 0 &&
              !s.includes(".") &&
              !["__proto__", "constructor", "prototype"].includes(s)
          ),
        primitiveArb,
        (path, value) => {
          // 测试 setFieldValue 往返一致性
          const store = new FormStore()
          store.setFieldValue(path as any, value)
          expect(store.getFieldValue(path as any)).toEqual(value)
          store.destroy()

          // 测试 setFieldsValue 往返一致性
          const store2 = new FormStore()
          const obj: Record<string, unknown> = {}
          obj[path] = value
          store2.setFieldsValue(obj)
          expect(store2.getFieldValue(path as any)).toEqual(value)
          store2.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pure-signal-core-refactor, Property 5: reset 产生正确的 store 状态（diff 式更新）
  // **Validates: Requirements 4.1, 4.3, 4.4**
  it("Property 5: reset 后目标路径返回正确值，旧路径不在目标中的返回 undefined", () => {
    // 使用原始类型值，避免 collectObjectPathsByLeaf 将对象/数组展开为嵌套路径
    const primitiveArb = fc.oneof(
      fc.string(),
      fc.integer(),
      fc.double({ noNaN: true }),
      fc.boolean(),
      fc.constant(null)
    )

    fc.assert(
      fc.property(
        fc.record({ a: primitiveArb, b: primitiveArb }),
        fc.record({ b: primitiveArb, c: primitiveArb }),
        (initialValues, targetValues) => {
          // 使用初始值创建 store
          const store = new FormStore({ initialValues })

          // reset 到目标值
          store.reset(targetValues)

          // 验证目标路径返回正确值
          for (const key of Object.keys(targetValues)) {
            expect(store.getFieldValue(key as any)).toEqual((targetValues as any)[key])
          }

          // 验证不在目标值中的旧路径返回 undefined（"a" 不在 targetValues 中）
          expect(store.getFieldValue("a" as any)).toBeUndefined()

          store.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pure-signal-core-refactor, Property 6: effect 在 reset 后依赖不断裂
  // **Validates: Requirements 4.2**
  it("Property 6: reset 后修改同一字段，effect 应被重新执行（依赖不断裂）", () => {
    fc.assert(
      fc.property(
        fc
          .string()
          .filter(
            (s) =>
              s.length > 0 &&
              !s.includes(".") &&
              !["__proto__", "constructor", "prototype"].includes(s)
          ),
        fc.integer(),
        fc.integer(),
        (path, initialValue, resetValue) => {
          // 使用初始值创建 store
          const initObj: Record<string, unknown> = {}
          initObj[path] = initialValue
          const store = new FormStore({ initialValues: initObj })

          // 创建 effect 追踪该字段
          let effectRunCount = 0
          store.effect(() => {
            store.getFieldValue(path as any)
            effectRunCount++
          })

          // effect 首次执行
          expect(effectRunCount).toBe(1)

          // reset，该字段仍存在（使用不同值）
          const resetObj: Record<string, unknown> = {}
          resetObj[path] = resetValue
          store.reset(resetObj)

          // reset 后记录 effect 执行次数
          const countAfterReset = effectRunCount

          // 使用一个确定不同的值来触发 effect
          const uniqueNewValue = `__unique_${Date.now()}_${Math.random()}`
          store.setFieldValue(path as any, uniqueNewValue)

          // effect 应被重新执行，说明依赖没有断裂
          expect(effectRunCount).toBeGreaterThan(countAfterReset)

          store.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pure-signal-core-refactor, Property 7: effect + getFieldValue 依赖追踪
  // **Validates: Requirements 5.1, 5.3**
  it("Property 7: effect 内调用 getFieldValue 建立依赖后，setFieldValue 应触发 effect 重新执行", () => {
    fc.assert(
      fc.property(
        fc
          .string()
          .filter(
            (s) =>
              s.length > 0 &&
              !s.includes(".") &&
              !["__proto__", "constructor", "prototype"].includes(s)
          ),
        fc.anything(),
        fc.anything(),
        (path, initialValue, newValueRaw) => {
          // 确保新旧值不同，Signal 对相同值不触发 effect
          const newValue =
            JSON.stringify(initialValue) === JSON.stringify(newValueRaw)
              ? "___different___"
              : newValueRaw

          // 创建 store 并设置初始值
          const initObj: Record<string, unknown> = {}
          initObj[path] = initialValue
          const store = new FormStore({ initialValues: initObj })

          // 创建 effect，内部通过 getFieldValue 建立依赖
          let effectRunCount = 0
          store.effect(() => {
            store.getFieldValue(path as any)
            effectRunCount++
          })

          // effect 首次执行
          expect(effectRunCount).toBe(1)

          // 修改该字段值
          store.setFieldValue(path as any, newValue)

          // effect 应被重新执行
          expect(effectRunCount).toBe(2)

          store.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pure-signal-core-refactor, Property 8: batch 将多次更新合并为单次 effect 执行
  // **Validates: Requirements 5.2**
  it("Property 8: batch 内多次 setFieldValue，依赖该字段的 effect 应只触发一次", () => {
    fc.assert(
      fc.property(
        fc
          .string()
          .filter(
            (s) =>
              s.length > 0 &&
              !s.includes(".") &&
              !["__proto__", "constructor", "prototype"].includes(s)
          ),
        fc.array(fc.anything(), { minLength: 2, maxLength: 10 }),
        (path, values) => {
          // 创建 store 并设置初始值
          const initObj: Record<string, unknown> = {}
          initObj[path] = "initial"
          const store = new FormStore({ initialValues: initObj })

          // 创建 effect，跳过首次执行
          let effectCount = 0
          let isFirst = true
          store.effect(() => {
            store.getFieldValue(path as any)
            if (isFirst) {
              isFirst = false

              return
            }

            effectCount++
          })

          // 在 batch 内执行多次 setFieldValue
          store.batch(() => {
            for (const v of values) {
              store.setFieldValue(path as any, v)
            }
          })

          // effect 应只触发一次
          expect(effectCount).toBe(1)

          store.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })
})
