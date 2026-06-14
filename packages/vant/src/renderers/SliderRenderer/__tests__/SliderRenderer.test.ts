// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { mount } from "@vue/test-utils"
import { defineComponent, h } from "vue"
import { describe, expect, it, vi } from "vitest"

vi.mock("vant", () => ({
  Slider: defineComponent({
    name: "Slider",
    props: ["modelValue", "disabled"],
    emits: ["update:modelValue"],
    setup(props, { emit }) {
      return () =>
        h("button", { onClick: () => emit("update:modelValue", 50) }, String(props.modelValue))
    },
  }),
}))

import SliderRenderer from "../index.vue"

describe("SliderRenderer", () => {
  it("view 状态使用 DisplayText 展示当前值且不渲染 Slider", () => {
    const wrapper = mount(SliderRenderer, {
      props: {
        view: true,
        value: 60,
      },
    })

    const displayText = wrapper.findComponent({ name: "SchemxDisplayText" })

    expect(displayText.exists()).toBe(true)
    expect(displayText.props("value")).toBe(60)
    expect(displayText.props("view")).toBe(true)
    expect(wrapper.findComponent({ name: "Slider" }).exists()).toBe(false)

    wrapper.unmount()
  })
})
