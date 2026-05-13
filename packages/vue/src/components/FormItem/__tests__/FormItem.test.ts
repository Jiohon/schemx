/**
 * FormItem 集成测试
 *
 * 验证 FormItem 组件与 runtime 已解析 schema 投影的集成行为：
 * - 新格式 Dependency_Object 由 core runtime 解析并驱动动态渲染
 * - 无 dependencies 时静态值直接生效
 *
 * @module components/FormItem/__tests__/FormItem
 */

import { defineComponent, h, nextTick } from "vue"

import { createFormInstance } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import { FORM_CONTEXT_KEY } from "@/hooks/useContext"
import { FORM_INSTANCE_KEY } from "@/hooks/useForm"

import FormItem from "../index"

import type { FormContextProps } from "@/hooks/useContext"
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

describe("FormItem 集成测试", () => {
  it("runtime resolved schema projection 驱动 visible 随依赖字段变化", async () => {
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

    form.getInternalHooks().registerRenderer("input", InputRenderer)
    await form.getInternalHooks().waitForDependencies()

    const wrapper = mount(FormItem, {
      props: { schema: form.getInternalHooks().getResolvedSchemas()[0] },
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
    await form.getInternalHooks().waitForDependencies()
    await wrapper.setProps({ schema: form.getInternalHooks().getResolvedSchemas()[0] })
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

    form.getInternalHooks().registerRenderer("input", InputRenderer)

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

    form.getInternalHooks().registerRenderer("input", InputRenderer)

    const wrapper = mount(FormItem, {
      props: { schema: form.getInternalHooks().getResolvedSchemas()[0] },
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
})
