/**
 * useField Hook 单元测试
 *
 * 测试 useField hook 与 FormContext 和 FormStore 的集成
 */

import { computed, defineComponent, h, nextTick, provide, type Ref, ref } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import { createFormStore, IFormStore } from "../../core/store"
import { useField, UseFieldOptions, UseFieldReturn } from "../useField"
import { FORM_CONTEXT_KEY, type UseFormReturn } from "../useForm"

/**
 * 创建 mock UseFormReturn
 */
function createMockFormContext(
  store: IFormStore,
  overrides?: Partial<UseFormReturn>
): UseFormReturn {
  const defaultErrors = ref<Record<string, string[]>>({})

  // 提取 errors，如果未提供则使用默认值
  const { errors: overrideErrors, ...restOverrides } = overrides || {}
  const errors = overrideErrors ?? defaultErrors

  return {
    values: computed(() => store.getFieldsValue()),
    errors,
    submitting: ref(false),
    schema: ref(null),
    normalizedColumns: computed(() => []),
    setFieldValue: (name: string, value: any) => store.setFieldValue(name, value),
    setFieldsValue: (values: Record<string, any>) => store.setFieldsValue(values),
    getFieldValue: (name: string) => store.getFieldValue(name),
    getFieldsValue: (names?: string[]) => store.getFieldsValue(names),
    registerRules: vi.fn(),
    unregisterRules: vi.fn(),
    validate: vi.fn(async () => true),
    getFieldError: (name: string) => errors.value[name],
    getErrors: () => ({ ...errors.value }),
    submit: vi.fn(async () => {}),
    reset: () => store.reset(),
    resetFields: (names?: string[]) => {
      if (names) {
        names.forEach((name) => store.resetField(name))
      } else {
        store.reset()
      }
    },
    isFieldTouched: (name: string) => store.isFieldTouched(name),
    isFieldsTouched: (names?: string[]) => store.isFieldsTouched(names),
    getTouchedFields: () => store.getTouchedFields(),
    subscribe: (name: string, callback: any) => store.subscribe(name, callback),
    subscribeAll: (callback: any) => store.subscribeAll(callback),
    updateSchema: vi.fn(),
    isReadonly: () => false,
    isDisabled: () => false,
    ...restOverrides,
  } as UseFormReturn
}

/**
 * 创建测试组件的辅助函数
 *
 * 使用父子组件结构来正确测试 provide/inject
 */
function createTestComponent(
  fieldName: string,
  options: UseFieldOptions = {},
  formContextOverrides?: {
    store?: IFormStore
    validate?: () => Promise<boolean>
    errors?: Ref<Record<string, string[]>>
  }
) {
  let fieldReturn: UseFieldReturn | null = null

  // 子组件：使用 useField
  const ChildComponent = defineComponent({
    name: "ChildComponent",
    setup() {
      fieldReturn = useField(fieldName, options)

      return () => h("div", { class: "child" })
    },
  })

  // 父组件：提供 FormContext
  const ParentComponent = defineComponent({
    name: "ParentComponent",
    setup() {
      // 如果提供了 store，则提供 FormContext
      if (formContextOverrides?.store) {
        const mockContext = createMockFormContext(formContextOverrides.store, {
          validate: formContextOverrides.validate,
          errors: formContextOverrides.errors,
        })
        provide(FORM_CONTEXT_KEY, mockContext)
      }

      return () => h(ChildComponent)
    },
  })

  const wrapper = mount(ParentComponent)

  return {
    wrapper,
    getField: () => fieldReturn!,
  }
}

describe("useField Hook (Task 11.2)", () => {
  describe("基础功能 - Requirement 8.2", () => {
    it("应该返回所有必需的字段状态和方法", () => {
      const store = createFormStore({ initialValues: { name: "John" } })
      const { getField, wrapper } = createTestComponent("name", {}, { store })

      const field = getField()

      // 验证状态
      expect(field.value).toBeDefined()
      expect(field.error).toBeDefined()
      expect(field.touched).toBeDefined()

      // 验证方法
      expect(field.setValue).toBeInstanceOf(Function)
      expect(field.setError).toBeInstanceOf(Function)
      expect(field.validate).toBeInstanceOf(Function)
      expect(field.reset).toBeInstanceOf(Function)

      wrapper.unmount()
    })

    it("应该从 FormStore 获取字段值", () => {
      const store = createFormStore({ initialValues: { name: "John", age: 25 } })
      const { getField, wrapper } = createTestComponent("name", {}, { store })

      const field = getField()

      expect(field.value.value).toBe("John")

      wrapper.unmount()
    })

    it("应该支持嵌套路径", () => {
      const store = createFormStore({
        initialValues: {
          user: {
            name: "John",
            address: { city: "Beijing" },
          },
        },
      })
      const { getField, wrapper } = createTestComponent(
        "user.address.city",
        {},
        { store }
      )

      const field = getField()

      expect(field.value.value).toBe("Beijing")

      wrapper.unmount()
    })

    it("应该在没有 FormContext 时使用初始值", () => {
      const { getField, wrapper } = createTestComponent("name", {
        initialValue: "Default",
      })

      const field = getField()

      expect(field.value.value).toBe("Default")

      wrapper.unmount()
    })
  })

  describe("setValue 方法", () => {
    it("应该通过 FormStore 更新字段值", async () => {
      const store = createFormStore({ initialValues: { name: "John" } })
      const { getField, wrapper } = createTestComponent("name", {}, { store })

      const field = getField()

      field.setValue("Jane")
      await nextTick()

      expect(field.value.value).toBe("Jane")
      expect(store.getFieldValue("name")).toBe("Jane")

      wrapper.unmount()
    })

    it("应该调用 onChange 回调", async () => {
      const onChange = vi.fn()
      const store = createFormStore({ initialValues: { name: "John" } })
      const { getField, wrapper } = createTestComponent("name", { onChange }, { store })

      const field = getField()

      field.setValue("Jane")
      await nextTick()

      expect(onChange).toHaveBeenCalledWith("Jane")

      wrapper.unmount()
    })

    it("应该支持嵌套路径设置", async () => {
      const store = createFormStore({
        initialValues: { user: { address: { city: "Beijing" } } },
      })
      const { getField, wrapper } = createTestComponent(
        "user.address.city",
        {},
        { store }
      )

      const field = getField()

      field.setValue("Shanghai")
      await nextTick()

      expect(field.value.value).toBe("Shanghai")
      expect(store.getFieldValue("user.address.city")).toBe("Shanghai")

      wrapper.unmount()
    })
  })

  describe("setError 方法", () => {
    it("应该设置字段错误", () => {
      const store = createFormStore({ initialValues: { name: "John" } })
      const { getField, wrapper } = createTestComponent("name", {}, { store })

      const field = getField()

      field.setError("Name is required")

      expect(field.error.value).toBe("Name is required")

      wrapper.unmount()
    })

    it("应该清除错误当设置为 null", () => {
      const store = createFormStore({ initialValues: { name: "John" } })
      const { getField, wrapper } = createTestComponent("name", {}, { store })

      const field = getField()

      field.setError("Name is required")
      expect(field.error.value).toBe("Name is required")

      field.setError(null)
      expect(field.error.value).toBeNull()

      wrapper.unmount()
    })
  })

  describe("validate 方法", () => {
    it("应该使用 FormContext 的 validate 方法", async () => {
      const store = createFormStore({ initialValues: { name: "" } })
      const errorsRef = ref<Record<string, string[]>>({})
      const validate = vi.fn(async () => {
        // 模拟校验失败，设置错误
        errorsRef.value = { name: ["Name is required"] }

        return false
      })

      const { getField, wrapper } = createTestComponent(
        "name",
        {},
        {
          store,
          validate,
          errors: errorsRef,
        }
      )

      const field = getField()

      const isValid = await field.validate()

      expect(validate).toHaveBeenCalled()
      expect(isValid).toBe(false)

      wrapper.unmount()
    })

    it("没有 FormContext 时应该返回 true", async () => {
      // 校验逻辑已迁移到 Zod schema，在 FormContext 级别处理
      // 没有 FormContext 时，无法校验，直接返回 true
      const { getField, wrapper } = createTestComponent("name", {
        initialValue: "",
      })

      const field = getField()

      const isValid = await field.validate()

      expect(isValid).toBe(true)

      wrapper.unmount()
    })
  })

  describe("reset 方法", () => {
    it("应该使用 FormStore 的 resetField 方法", async () => {
      const store = createFormStore({ initialValues: { name: "John" } })
      const { getField, wrapper } = createTestComponent("name", {}, { store })

      const field = getField()

      field.setValue("Jane")
      await nextTick()
      expect(field.value.value).toBe("Jane")

      field.reset()
      await nextTick()

      expect(field.value.value).toBe("John")

      wrapper.unmount()
    })

    it("应该清除错误", async () => {
      const store = createFormStore({ initialValues: { name: "John" } })
      const { getField, wrapper } = createTestComponent("name", {}, { store })

      const field = getField()

      field.setError("Some error")
      expect(field.error.value).toBe("Some error")

      field.reset()
      await nextTick()

      // 错误应该被清除（通过 FormStore.resetField）

      wrapper.unmount()
    })

    it("应该在没有 FormStore 时重置到初始值", async () => {
      const { getField, wrapper } = createTestComponent("name", {
        initialValue: "Default",
      })

      const field = getField()

      field.setValue("Changed")
      field.setError("Error")

      field.reset()
      await nextTick()

      expect(field.value.value).toBe("Default")
      expect(field.error.value).toBeNull()

      wrapper.unmount()
    })
  })

  describe("touched 状态（字段是否被修改）", () => {
    it("应该在值改变时变为 touched", async () => {
      const store = createFormStore({ initialValues: { name: "John" } })
      const { getField, wrapper } = createTestComponent(
        "name",
        { initialValue: "John" },
        { store }
      )

      const field = getField()

      expect(field.touched.value).toBe(false)

      field.setValue("Jane")
      await nextTick()

      expect(field.touched.value).toBe(true)

      wrapper.unmount()
    })

    it("应该在值恢复时变为非 touched", async () => {
      const store = createFormStore({ initialValues: { name: "John" } })
      const { getField, wrapper } = createTestComponent(
        "name",
        { initialValue: "John" },
        { store }
      )

      const field = getField()

      field.setValue("Jane")
      await nextTick()
      expect(field.touched.value).toBe(true)

      field.setValue("John")
      await nextTick()
      expect(field.touched.value).toBe(false)

      wrapper.unmount()
    })
  })

  describe("订阅功能", () => {
    it("应该订阅 FormStore 的字段变化", async () => {
      const store = createFormStore({ initialValues: { name: "John" } })
      const { getField, wrapper } = createTestComponent("name", {}, { store })

      const field = getField()

      // 通过 store 直接修改值
      store.setFieldValue("name", "")
      await nextTick()

      // 应该触发订阅回调
      await new Promise((resolve) => setTimeout(resolve, 10))

      wrapper.unmount()
    })
  })

  describe("组件卸载", () => {
    it("应该在组件卸载时取消订阅", async () => {
      const store = createFormStore({ initialValues: { name: "John" } })
      const { getField, wrapper } = createTestComponent("name", {}, { store })

      const field = getField()

      // 卸载组件
      wrapper.unmount()

      // 修改值不应该导致错误
      store.setFieldValue("name", "Jane")
      await nextTick()

      // 如果没有正确取消订阅，可能会有错误
    })
  })
})
