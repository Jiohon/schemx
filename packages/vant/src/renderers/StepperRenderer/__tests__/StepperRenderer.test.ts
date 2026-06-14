// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { mount } from "@vue/test-utils"
import { defineComponent, h } from "vue"
import { describe, expect, it, vi } from "vitest"

vi.mock("vant", () => ({
  Stepper: defineComponent({
    name: "Stepper",
    props: ["modelValue", "disabled"],
    emits: ["update:modelValue"],
    setup(props, { emit }) {
      return () =>
        h("button", { onClick: () => emit("update:modelValue", 2) }, String(props.modelValue))
    },
  }),
}))

import StepperRenderer from "../index.vue"

describe("StepperRenderer", () => {
  it("view 状态使用 DisplayText 展示当前值且不渲染 Stepper", () => {
    const wrapper = mount(StepperRenderer, {
      props: {
        view: true,
        value: 5,
      },
    })

    const displayText = wrapper.findComponent({ name: "SchemxDisplayText" })

    expect(displayText.exists()).toBe(true)
    expect(displayText.props("value")).toBe(5)
    expect(displayText.props("view")).toBe(true)
    expect(wrapper.findComponent({ name: "Stepper" }).exists()).toBe(false)

    wrapper.unmount()
  })
})
