/**
 * FormItem 集成测试
 *
 * 验证 FormItem 组件与 core 处理后的 ViewSchema 的集成行为：
 * - 新格式 Dependency_Object 由 core 解析并驱动动态渲染
 * - 无 dependencies 时静态值直接生效
 *
 * @module components/FormItem/__tests__/FormItem
 */

import { defineComponent, h, nextTick } from "vue"

import { createFormInstance } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import { FORM_CONTEXT_KEY } from "@/hooks/useContext"
import type { FormContextProps } from "@/hooks/useContext"
import { FORM_INSTANCE_KEY } from "@/hooks/useForm"

import FormItem from "../index"

import type { SchemxBaseField, SchemxInstance } from "@schemx/core"

/**
 * 创建最小化的 FormContext 配置
 */
function createFormContext(overrides?: Partial<FormContextProps>): FormContextProps {
  return {
    schemas: [],
    labelPosition: "left",
    labelAlign: "left",
    contentAlign: "left",
    colon: false,
    ...overrides,
  }
}

/**
 * 简单的 input 渲染器组件
 */
const InputRenderer = defineComponent({
  name: "InputRenderer",
  setup() {
    return () => h("input", { "data-testid": "input-renderer" })
  },
})

const ControlledRenderer = defineComponent({
  name: "ControlledRenderer",
  props: {
    value: String,
    onChange: Function,
  },
  emits: ["update:value"],
  setup(props, { emit }) {
    return () =>
      h("input", {
        "data-testid": "controlled-renderer",
        value: props.value,
        onInput: (event: Event) => {
          emit("update:value", (event.target as HTMLInputElement).value)
        },
      })
  },
})

const ChangeRenderer = defineComponent({
  name: "ChangeRenderer",
  props: {
    value: String,
    onChange: Function,
  },
  setup(props) {
    return () =>
      h("input", {
        "data-testid": "change-renderer",
        value: props.value,
        onInput: (event: Event) => {
          props.onChange?.((event.target as HTMLInputElement).value)
        },
      })
  },
})

const ProbeRenderer = defineComponent({
  name: "ProbeRenderer",
  props: {
    value: String,
    readonly: Boolean,
    disabled: Boolean,
    onChange: Function,
    onBlur: Function,
  },
  setup(props) {
    return () =>
      h("input", {
        "data-testid": "probe-renderer",
        "data-readonly": String(props.readonly),
        "data-disabled": String(props.disabled),
        value: props.value,
        onInput: (event: Event) => {
          props.onChange?.((event.target as HTMLInputElement).value)
        },
        onBlur: (event: FocusEvent) => {
          props.onBlur?.(event)
        },
      })
  },
})

describe("FormItem 集成测试", () => {
  it("ViewSchema 驱动 visible 随依赖字段变化", async () => {
    const schema: SchemxBaseField = {
      name: "city",
      label: "城市",
      componentType: "input" as any,
      dependencies: {
        triggerFields: ["province"],
        visible: (values: any) => !!values.province,
      },
    }

    const form: SchemxInstance = createFormInstance({
      initialValues: { province: "guangdong" },
      schemas: [schema as any],
    })

    form.registerRenderer("input", InputRenderer)
    await form.waitForDependencies()

    const wrapper = mount(FormItem, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [FORM_INSTANCE_KEY]: form,
          [FORM_CONTEXT_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    // province 有值 → visible 应为 true → 组件应渲染
    expect(wrapper.find(".schemx-item-wrapper").exists()).toBe(true)

    // 将 province 设为空字符串
    form.setFieldValue("province", "")
    await form.waitForDependencies()
    await wrapper.setProps({ schema: form.getViewSchemas()[0] })
    await nextTick()

    // province 为空 → visible 应为 false → 组件不应渲染
    expect(wrapper.find(".schemx-item-wrapper").exists()).toBe(false)

    wrapper.unmount()
    form.destroy()
  })

  it("无 dependencies 时静态 visible: false 直接生效，组件不渲染", async () => {
    const form: SchemxInstance = createFormInstance({
      initialValues: { name: "" },
    })

    form.registerRenderer("input", InputRenderer)

    const schema: SchemxBaseField = {
      name: "name",
      label: "姓名",
      componentType: "input" as any,
      visible: false,
    }

    const wrapper = mount(FormItem, {
      props: { schema },
      global: {
        provide: {
          [FORM_INSTANCE_KEY]: form,
          [FORM_CONTEXT_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    // visible 为 false（静态值），组件不应渲染
    expect(wrapper.find(".schemx-item-wrapper").exists()).toBe(false)

    wrapper.unmount()
    form.destroy()
  })

  it("字段挂载时不应使用 schema initialValue 覆盖已存在的字段值", async () => {
    const schema: SchemxBaseField = {
      name: "pickupStore",
      label: "自提门店",
      componentType: "input" as any,
      initialValue: "mixc",
    }

    const form: SchemxInstance = createFormInstance({
      initialValues: { pickupStore: "hubin" },
      schemas: [schema as any],
    })

    form.registerRenderer("input", InputRenderer)

    const wrapper = mount(FormItem, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [FORM_INSTANCE_KEY]: form,
          [FORM_CONTEXT_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()
    await Promise.resolve()

    expect(form.getFieldValue("pickupStore")).toBe("hubin")

    wrapper.unmount()
    form.destroy()
  })

  it("向受控 renderer 下发字段值，并将 update:value 写回 store", async () => {
    const schema: SchemxBaseField = {
      name: "website",
      label: "个人网站",
      componentType: "controlled" as any,
    }

    const form: SchemxInstance = createFormInstance({
      initialValues: { website: "www.baidu.com" },
      schemas: [schema as any],
    })

    form.registerRenderer("controlled" as any, ControlledRenderer)

    const wrapper = mount(FormItem, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [FORM_INSTANCE_KEY]: form,
          [FORM_CONTEXT_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    const input = wrapper.get<HTMLInputElement>('[data-testid="controlled-renderer"]')

    expect(input.element.value).toBe("www.baidu.com")

    await input.setValue("schemx.dev")

    expect(form.getFieldValue("website")).toBe("schemx.dev")

    wrapper.unmount()
    form.destroy()
  })

  it("将 renderer 的 onChange 值写回 store", async () => {
    const schema: SchemxBaseField = {
      name: "bio",
      label: "个人简介",
      componentType: "change" as any,
    }

    const form: SchemxInstance = createFormInstance({
      schemas: [schema as any],
    })

    form.registerRenderer("change" as any, ChangeRenderer)

    const wrapper = mount(FormItem, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [FORM_INSTANCE_KEY]: form,
          [FORM_CONTEXT_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    await wrapper.get('[data-testid="change-renderer"]').setValue("新的简介")

    expect(form.getFieldValue("bio")).toBe("新的简介")

    wrapper.unmount()
    form.destroy()
  })

  it("readonly=true 时下发给 renderer、隐藏 required 星号并跳过校验", async () => {
    const schema: SchemxBaseField = {
      name: "title",
      label: "标题",
      componentType: "probe" as any,
      readonly: true,
      required: true,
      rules: "required",
    }

    const form: SchemxInstance = createFormInstance({
      initialValues: { title: "旧标题" },
      schemas: [schema as any],
    })

    form.registerRenderer("probe" as any, ProbeRenderer)
    const validateSpy = vi.spyOn(form, "validateField")

    const wrapper = mount(FormItem, {
      props: { schema: form.getViewSchemas()[0] },
      global: {
        provide: {
          [FORM_INSTANCE_KEY]: form,
          [FORM_CONTEXT_KEY]: createFormContext(),
        },
      },
    })

    await nextTick()

    const input = wrapper.get('[data-testid="probe-renderer"]')

    expect(input.attributes("data-readonly")).toBe("true")
    expect(input.attributes("data-disabled")).toBe("false")
    expect(wrapper.find(".schemx-item__required").exists()).toBe(false)
    expect(wrapper.find(".schemx-item.is-readonly").exists()).toBe(true)

    await input.setValue("")
    await input.trigger("blur")

    expect(form.getFieldValue("title")).toBe("")
    expect(validateSpy).not.toHaveBeenCalled()

    wrapper.unmount()
    form.destroy()
  })
})
