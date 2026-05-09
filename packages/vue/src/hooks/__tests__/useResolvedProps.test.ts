/**
 * useDependencies 属性测试
 *
 * 使用 fast-check 对 {@link useDependencies} 进行基于属性的测试，
 * 验证其在 Vue 组件上下文中的行为满足设计文档中定义的正确性属性。
 *
 * @module hooks/__tests__/useResolvedProps
 */

import { defineComponent, h, nextTick } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import * as fc from "fast-check"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useDependencies } from "../useDependencies"
import { SCHEMX_INSTANCE_KEY } from "../useForm"

import type { SchemxDependenciesStaticProps } from "@schemx/core"

/**
 * 生成随机的 SchemxDependenciesStaticProps 对象
 */
const defaultsArb: fc.Arbitrary<SchemxDependenciesStaticProps> = fc.record({
  visible: fc.boolean(),
  readonly: fc.boolean(),
  disabled: fc.boolean(),
  required: fc.boolean(),
  placeholder: fc.string({ minLength: 0, maxLength: 50 }),
  componentProps: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 10 }),
    fc.oneof(fc.string(), fc.integer(), fc.boolean())
  ),
})

describe("useDependencies", () => {
  // Feature: dependencies-object-refactor, Property 2: 静态默认值回退
  // **Validates: Requirements 2.3, 8.4**
  it("Property 2: 当 dependencies 为 undefined 时，返回的状态与静态默认值完全一致", () => {
    fc.assert(
      fc.property(defaultsArb, (defaults) => {
        const form = createForm({ initialValues: {} })

        let resolved: SchemxDependenciesStaticProps | null = null

        const Comp = defineComponent({
          setup() {
            resolved = useDependencies(form, undefined, defaults)

            return () => h("div")
          },
        })

        const wrapper = mount(Comp, {
          global: {
            provide: { [SCHEMX_INSTANCE_KEY]: form },
          },
        })

        expect(resolved).not.toBeNull()
        expect(resolved!.visible).toBe(defaults.visible)
        expect(resolved!.readonly).toBe(defaults.readonly)
        expect(resolved!.disabled).toBe(defaults.disabled)
        expect(resolved!.required).toBe(defaults.required)
        expect(resolved!.placeholder).toBe(defaults.placeholder)
        expect(resolved!.componentProps).toEqual(defaults.componentProps)

        wrapper.unmount()
        form.destroy()
      }),
      { numRuns: 100 }
    )
  })

  // Feature: dependencies-object-refactor, 共享 triggerFields 触发所有条件函数
  describe("共享 triggerFields", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("任一 triggerField 变化时，所有已配置的条件函数都被执行", async () => {
      const visibleCondition = vi.fn(
        (values: Record<string, unknown>) => !!values.province
      )
      const disabledCondition = vi.fn(
        (values: Record<string, unknown>) => values.country === "overseas"
      )

      const form = createForm({
        initialValues: { province: "guangdong", country: "china" },
      })

      const Comp = defineComponent({
        setup() {
          useDependencies(form, 
            {
              triggerFields: ["province", "country"],
              visible: visibleCondition,
              disabled: disabledCondition,
            },
            {
              visible: true,
              readonly: false,
              disabled: false,
              required: false,
              placeholder: "",
              componentProps: {},
            }
          )

          return () => h("div")
        },
      })

      const wrapper = mount(Comp, {
        global: {
          provide: { [SCHEMX_INSTANCE_KEY]: form },
        },
      })

      vi.advanceTimersByTime(20)
      await nextTick()

      visibleCondition.mockClear()
      disabledCondition.mockClear()

      // 仅改变 province，但两个条件函数都应被调用（共享 triggerFields）
      form.setFieldValue("province", "beijing")

      vi.advanceTimersByTime(20)
      await nextTick()

      expect(visibleCondition).toHaveBeenCalled()
      expect(disabledCondition).toHaveBeenCalled()

      wrapper.unmount()
      form.destroy()
    })
  })

  // Feature: dependencies-object-refactor, Property 8: trigger 执行顺序
  // **Validates: Requirements 6.1, 6.3**
  describe("Property 8: trigger 执行顺序", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("trigger 先于其他属性的条件函数执行", async () => {
      const callOrder: string[] = []

      const triggerCondition = vi.fn(() => {
        callOrder.push("trigger")
      })

      const visibleCondition = vi.fn(() => {
        callOrder.push("visible")

        return true
      })

      const form = createForm({
        initialValues: { province: "guangdong" },
      })

      const Comp = defineComponent({
        setup() {
          useDependencies(form, 
            {
              triggerFields: ["province"],
              trigger: triggerCondition,
              visible: visibleCondition,
            },
            {
              visible: true,
              readonly: false,
              disabled: false,
              required: false,
              placeholder: "",
              componentProps: {},
            }
          )

          return () => h("div")
        },
      })

      const wrapper = mount(Comp, {
        global: {
          provide: { [SCHEMX_INSTANCE_KEY]: form },
        },
      })

      vi.advanceTimersByTime(20)
      await nextTick()

      callOrder.length = 0
      triggerCondition.mockClear()
      visibleCondition.mockClear()

      form.setFieldValue("province", "beijing")

      vi.advanceTimersByTime(20)
      await nextTick()

      expect(triggerCondition).toHaveBeenCalled()
      expect(visibleCondition).toHaveBeenCalled()
      expect(callOrder[0]).toBe("trigger")

      wrapper.unmount()
      form.destroy()
    })
  })

  // 单元测试
  describe("单元测试", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("debounce 合并行为：短时间内多次变更仅触发一次条件函数执行", async () => {
      const visibleCondition = vi.fn(() => true)

      const form = createForm({
        initialValues: { count: 0 },
      })

      const Comp = defineComponent({
        setup() {
          useDependencies(form, 
            {
              triggerFields: ["count"],
              visible: visibleCondition,
            },
            {
              visible: true,
              readonly: false,
              disabled: false,
              required: false,
              placeholder: "",
              componentProps: {},
            }
          )

          return () => h("div")
        },
      })

      const wrapper = mount(Comp, {
        global: {
          provide: { [SCHEMX_INSTANCE_KEY]: form },
        },
      })

      vi.advanceTimersByTime(20)
      await nextTick()

      visibleCondition.mockClear()

      form.setFieldValue("count", 1)
      form.setFieldValue("count", 2)
      form.setFieldValue("count", 3)

      vi.advanceTimersByTime(20)
      await nextTick()

      expect(visibleCondition).toHaveBeenCalledTimes(1)

      wrapper.unmount()
      form.destroy()
    })

    it("无 dependencies 时静态值直接生效", () => {
      const defaults: SchemxDependenciesStaticProps = {
        visible: false,
        readonly: true,
        disabled: true,
        required: true,
        placeholder: "请输入",
        componentProps: { size: "large" },
      }

      const form = createForm({ initialValues: {} })

      let resolved: SchemxDependenciesStaticProps | null = null

      const Comp = defineComponent({
        setup() {
          resolved = useDependencies(form, undefined, defaults)

          return () => h("div")
        },
      })

      const wrapper = mount(Comp, {
        global: {
          provide: { [SCHEMX_INSTANCE_KEY]: form },
        },
      })

      expect(resolved).not.toBeNull()
      expect(resolved!.visible).toBe(false)
      expect(resolved!.readonly).toBe(true)
      expect(resolved!.disabled).toBe(true)
      expect(resolved!.required).toBe(true)
      expect(resolved!.placeholder).toBe("请输入")
      expect(resolved!.componentProps).toEqual({ size: "large" })

      wrapper.unmount()
      form.destroy()
    })

    it("trigger 接收正确的 Values 参数", async () => {
      const triggerCondition = vi.fn()

      const form = createForm({
        initialValues: { province: "guangdong" },
      })

      const Comp = defineComponent({
        setup() {
          useDependencies(form, 
            {
              triggerFields: ["province"],
              trigger: triggerCondition,
              visible: () => true,
            },
            {
              visible: true,
              readonly: false,
              disabled: false,
              required: false,
              placeholder: "",
              componentProps: {},
            }
          )

          return () => h("div")
        },
      })

      const wrapper = mount(Comp, {
        global: {
          provide: { [SCHEMX_INSTANCE_KEY]: form },
        },
      })

      vi.advanceTimersByTime(20)
      await nextTick()

      triggerCondition.mockClear()

      form.setFieldValue("province", "beijing")

      vi.advanceTimersByTime(20)
      await nextTick()

      expect(triggerCondition).toHaveBeenCalledTimes(1)
      expect(triggerCondition.mock.calls[0][0]).toHaveProperty("province", "beijing")

      wrapper.unmount()
      form.destroy()
    })
  })
})
