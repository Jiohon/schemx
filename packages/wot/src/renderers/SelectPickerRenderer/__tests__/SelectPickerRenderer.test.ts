// @vitest-environment happy-dom

import { shallowMount } from "@vue/test-utils"
import { defineComponent, h } from "vue"
import { describe, expect, it, vi } from "vitest"

vi.mock("@wot-ui/ui/components/wd-select-picker/wd-select-picker.vue", () => ({
  default: defineComponent({
    name: "wd-select-picker",
    props: [
      "modelValue",
      "type",
      "columns",
      "visible",
      "onChange",
    ],
    emits: ["change", "confirm", "update:visible"],
    setup(_props, { slots }) {
      return () => h("div", { class: "wd-select-picker" }, slots.default?.())
    },
  }),
}))

import SelectPickerRenderer from "../index.vue"

describe("SelectPickerRenderer", () => {
  it("使用 Wot UI SelectPicker 渲染并传入默认多选值", () => {
    const wrapper = shallowMount(SelectPickerRenderer)
    const selectPicker = wrapper.findComponent({ name: "wd-select-picker" })

    expect(selectPicker.exists()).toBe(true)
    expect(selectPicker.props("modelValue")).toEqual([])
    expect(selectPicker.props("type")).toBe("checkbox")

    wrapper.unmount()
  })

  it("不把 Schemx 的 onChange 透传给 Wot UI SelectPicker", async () => {
    const onChange = vi.fn()
    const wrapper = shallowMount(SelectPickerRenderer, {
      props: {
        onChange,
      },
    })
    const selectPicker = wrapper.findComponent({ name: "wd-select-picker" })

    expect(selectPicker.props("onChange")).toBeUndefined()

    await selectPicker.vm.$emit("change", { value: ["a"] })

    expect(onChange).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it("确认选择后桥接 Schemx 的 value 更新契约", async () => {
    const onChange = vi.fn()
    const onConfirm = vi.fn()
    const wrapper = shallowMount(SelectPickerRenderer, {
      props: {
        value: [],
        onChange,
        onConfirm,
      },
    })
    const detail = {
      value: ["a"],
      selectedItems: [{ label: "选项 A", value: "a" }],
    }

    await wrapper.findComponent({ name: "wd-select-picker" }).vm.$emit("confirm", detail)

    expect(onChange).toHaveBeenCalledWith(["a"], detail)
    expect(onConfirm).toHaveBeenCalledWith(["a"], detail)
    expect(wrapper.emitted("update:value")?.[0]).toEqual([["a"]])

    wrapper.unmount()
  })
})
