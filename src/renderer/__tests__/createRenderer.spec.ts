/**
 * createRenderWrapper 工厂函数单元测试
 *
 * 测试渲染器工厂函数的核心功能：
 * - 状态合并（readonly, disabled）
 * - 插槽合并
 * - 值绑定
 * - 错误显示
 * - 默认占位符生成
 */

import { computed, defineComponent, h, provide, ref } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import { createFormStore } from "../../core/store"
import { FORM_CONTEXT_KEY, type UseFormReturn } from "../../hooks/useForm"
import { createRenderWrapper } from "../rendererWrapper"

// 创建一个简单的测试组件
const TestComponent = defineComponent({
  name: "TestComponent",
  props: {
    value: { type: null, default: undefined },
    onChange: { type: Function, default: undefined },
    onBlur: { type: Function, default: undefined },
    readonly: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    placeholder: { type: String, default: "" },
    error: { type: Array, default: undefined },
    formItemProps: { type: Object, default: () => ({}) },
    formInstance: { type: Object, default: undefined },
    align: { type: String, default: "left" },
  },
  setup(props) {
    return () =>
      h(
        "div",
        {
          class: "test-component",
          "data-value": props.value,
          "data-readonly": props.readonly,
          "data-disabled": props.disabled,
          "data-placeholder": props.placeholder,
          "data-error": JSON.stringify(props.error),
        },
        props.value
      )
  },
})

// 创建一个带插槽的测试组件
const TestComponentWithSlots = defineComponent({
  name: "TestComponentWithSlots",
  props: {
    value: { type: null, default: undefined },
  },
  setup(props, { slots }) {
    return () =>
      h("div", { class: "test-component-with-slots" }, [
        slots.prefix?.(),
        h("span", { class: "value" }, props.value),
        slots.suffix?.(),
      ])
  },
})

// 创建模拟的 UseFormReturn
function createMockFormContext(
  options: {
    readonly?: boolean
    disabled?: boolean
    errors?: Record<string, string[]>
  } = {}
): UseFormReturn {
  const store = createFormStore({ initialValues: {} })

  const errorsRef = ref<Record<string, string[]>>(options.errors || {})

  return {
    values: computed(() => store.getFieldsValue()),
    errors: errorsRef,
    submitting: ref(false),
    schema: ref(null),
    normalizedColumns: computed(() => []),
    setFieldValue: (name: string, value: any) => store.setFieldValue(name, value),
    setFieldsValue: (values: Record<string, any>) => store.setFieldsValue(values),
    getFieldValue: (name: string) => store.getFieldValue(name),
    getFieldsValue: (names?: string[]) => store.getFieldsValue(names),
    getInitialValue: (name: string) => store.getInitialValue(name),
    registerRules: vi.fn(),
    unregisterRules: vi.fn(),
    validate: vi.fn(async () => true),
    getFieldError: (name: string) => errorsRef.value[name],
    getErrors: () => ({ ...errorsRef.value }),
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
    isReadonly: () => options.readonly ?? false,
    isDisabled: () => options.disabled ?? false,
  }
}

// 创建带 FormContext 的包装组件
function createWrapperComponent(
  RendererComponent: ReturnType<typeof createRenderWrapper>,
  formContext: UseFormReturn | null,
  props: Record<string, any> = {}
) {
  return defineComponent({
    setup() {
      if (formContext) {
        provide(
          FORM_CONTEXT_KEY,
          computed(() => formContext)
        )
      }

      return () => h(RendererComponent, props)
    },
  })
}

describe("createRenderWrapper", () => {
  describe("基础功能", () => {
    it("应该返回一个 Vue Component", () => {
      const result = createRenderWrapper({
        component: TestComponent,
      })

      expect(result).toBeDefined()
      expect(typeof result).toBe("object")
    })

    it("应该正确渲染包装的组件", () => {
      const renderer = createRenderWrapper({
        component: TestComponent,
      })

      const wrapper = mount(renderer, {
        props: {
          value: "test value",
        },
      })

      expect(wrapper.find(".test-component").exists()).toBe(true)
      expect(wrapper.find(".test-component").attributes("data-value")).toBe("test value")
    })
  })

  describe("状态合并", () => {
    describe("readonly 状态合并", () => {
      it("当 props.readonly 为 true 时，应该为 readonly", () => {
        const renderer = createRenderWrapper({ component: TestComponent })
        const wrapper = mount(renderer, {
          props: { readonly: true },
        })

        expect(wrapper.find(".test-component").attributes("data-readonly")).toBe("true")
      })

      it("当 formItemProps.readonly 为 true 时，应该为 readonly", () => {
        const renderer = createRenderWrapper({ component: TestComponent })
        const wrapper = mount(renderer, {
          props: {
            formItemProps: { readonly: true },
          },
        })

        expect(wrapper.find(".test-component").attributes("data-readonly")).toBe("true")
      })

      it("当所有来源都为 false 时，应该不为 readonly", () => {
        const renderer = createRenderWrapper({ component: TestComponent })
        const formContext = createMockFormContext({ readonly: false })
        const WrapperComponent = createWrapperComponent(renderer, formContext, {
          readonly: false,
          formItemProps: { readonly: false },
        })

        const wrapper = mount(WrapperComponent)
        expect(wrapper.find(".test-component").attributes("data-readonly")).toBe("false")
      })

      it("应该使用 OR 逻辑合并 readonly 状态", () => {
        const renderer = createRenderWrapper({ component: TestComponent })
        const formContext = createMockFormContext({ readonly: false })
        const WrapperComponent = createWrapperComponent(renderer, formContext, {
          readonly: false,
          formItemProps: { readonly: true },
        })

        const wrapper = mount(WrapperComponent)
        expect(wrapper.find(".test-component").attributes("data-readonly")).toBe("true")
      })
    })

    describe("disabled 状态合并", () => {
      it("当 props.disabled 为 true 时，应该为 disabled", () => {
        const renderer = createRenderWrapper({ component: TestComponent })
        const wrapper = mount(renderer, {
          props: { disabled: true },
        })

        expect(wrapper.find(".test-component").attributes("data-disabled")).toBe("true")
      })

      it("当 formItemProps.disabled 为 true 时，应该为 disabled", () => {
        const renderer = createRenderWrapper({ component: TestComponent })
        const wrapper = mount(renderer, {
          props: {
            formItemProps: { disabled: true },
          },
        })

        expect(wrapper.find(".test-component").attributes("data-disabled")).toBe("true")
      })

      it("应该使用 OR 逻辑合并 disabled 状态", () => {
        const renderer = createRenderWrapper({ component: TestComponent })
        const formContext = createMockFormContext({ disabled: true })
        const WrapperComponent = createWrapperComponent(renderer, formContext, {
          disabled: false,
          formItemProps: { disabled: false },
        })

        const wrapper = mount(WrapperComponent)
        expect(wrapper.find(".test-component").attributes("data-disabled")).toBe("true")
      })
    })
  })

  describe("值绑定", () => {
    it("应该正确传递 value", () => {
      const renderer = createRenderWrapper({ component: TestComponent })
      const wrapper = mount(renderer, {
        props: { value: "test value" },
      })

      expect(wrapper.find(".test-component").attributes("data-value")).toBe("test value")
    })

    it("应该正确调用 onChange", async () => {
      const onChange = vi.fn()
      const renderer = createRenderWrapper({ component: TestComponent })
      const wrapper = mount(renderer, {
        props: { value: "initial", onChange },
      })

      const component = wrapper.findComponent(TestComponent)
      await component.vm.$props.onChange?.("new value")

      expect(onChange).toHaveBeenCalledWith("new value")
    })

    it("应该正确调用 onBlur", async () => {
      const onBlur = vi.fn()
      const renderer = createRenderWrapper({ component: TestComponent })
      const wrapper = mount(renderer, {
        props: { onBlur },
      })

      const component = wrapper.findComponent(TestComponent)
      await component.vm.$props.onBlur?.()

      expect(onBlur).toHaveBeenCalled()
    })
  })

  describe("默认占位符生成", () => {
    it('应该为输入类组件生成"请输入"占位符', () => {
      const renderer = createRenderWrapper({ component: TestComponent })
      const wrapper = mount(renderer, {
        props: {
          formItemProps: {
            componentType: "text",
            label: "用户名",
          },
        },
      })

      expect(wrapper.find(".test-component").attributes("data-placeholder")).toBe(
        "请输入用户名"
      )
    })

    it('应该为选择类组件生成"请选择"占位符', () => {
      const renderer = createRenderWrapper({ component: TestComponent })
      const wrapper = mount(renderer, {
        props: {
          formItemProps: {
            componentType: "picker",
            label: "城市",
          },
        },
      })

      expect(wrapper.find(".test-component").attributes("data-placeholder")).toBe(
        "请选择城市"
      )
    })

    it("当提供 placeholder 时应该使用提供的值", () => {
      const renderer = createRenderWrapper({ component: TestComponent })
      const wrapper = mount(renderer, {
        props: {
          placeholder: "自定义占位符",
          formItemProps: {
            componentType: "text",
            label: "用户名",
          },
        },
      })

      expect(wrapper.find(".test-component").attributes("data-placeholder")).toBe(
        "自定义占位符"
      )
    })

    it("当没有标签时应该生成空标签的占位符", () => {
      const renderer = createRenderWrapper({ component: TestComponent })
      const wrapper = mount(renderer, {
        props: {
          formItemProps: {
            componentType: "text",
          },
        },
      })

      expect(wrapper.find(".test-component").attributes("data-placeholder")).toBe(
        "请输入"
      )
    })
  })

  describe("插槽合并", () => {
    it("应该传递模板插槽", () => {
      const renderer = createRenderWrapper({ component: TestComponentWithSlots })
      const wrapper = mount(renderer, {
        props: { value: "test" },
        slots: {
          prefix: () => h("span", { class: "prefix" }, "Prefix"),
          suffix: () => h("span", { class: "suffix" }, "Suffix"),
        },
      })

      expect(wrapper.find(".prefix").exists()).toBe(true)
      expect(wrapper.find(".prefix").text()).toBe("Prefix")
      expect(wrapper.find(".suffix").exists()).toBe(true)
      expect(wrapper.find(".suffix").text()).toBe("Suffix")
    })
  })

  describe("默认属性", () => {
    it("应该应用默认属性", () => {
      const renderer = createRenderWrapper({
        component: TestComponent,
        defaultProps: {
          align: "center",
        },
      })

      const wrapper = mount(renderer, {
        props: { value: "test" },
      })

      const component = wrapper.findComponent(TestComponent)
      expect(component.vm.$props.align).toBe("center")
    })
  })

  describe("无 FormContext 时的行为", () => {
    it("当没有 FormContext 时应该正常工作", () => {
      const renderer = createRenderWrapper({ component: TestComponent })
      const wrapper = mount(renderer, {
        props: {
          value: "test",
          readonly: true,
          disabled: false,
        },
      })

      expect(wrapper.find(".test-component").attributes("data-value")).toBe("test")
      expect(wrapper.find(".test-component").attributes("data-readonly")).toBe("true")
      expect(wrapper.find(".test-component").attributes("data-disabled")).toBe("false")
    })
  })
})
