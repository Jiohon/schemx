// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names, vue/no-reserved-component-names */

import { mount } from "@vue/test-utils"
import { defineComponent, h } from "vue"
import { describe, expect, it, vi } from "vitest"

vi.mock("vant", () => ({
  Switch: defineComponent({
    name: "Switch",
    props: ["modelValue", "disabled", "loading"],
    emits: ["update:modelValue"],
    setup(props, { emit }) {
      return () =>
        h("button", { onClick: () => emit("update:modelValue", !props.modelValue) })
    },
  }),
}))

import SwitchRenderer from "../index.vue"

describe("SwitchRenderer", () => {
  it("view 状态使用 DisplayText 展示开关文本且不渲染 Switch", async () => {
    const onChange = vi.fn()
    const wrapper = mount(SwitchRenderer, {
      props: {
        view: true,
        value: true,
        activeText: "开启",
        inactiveText: "关闭",
        onChange,
      },
    })

    const displayText = wrapper.findComponent({ name: "SchemxDisplayText" })

    expect(displayText.exists()).toBe(true)
    expect(displayText.props("value")).toBe("开启")
    expect(displayText.props("view")).toBe(true)
    expect(wrapper.findComponent({ name: "Switch" }).exists()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
