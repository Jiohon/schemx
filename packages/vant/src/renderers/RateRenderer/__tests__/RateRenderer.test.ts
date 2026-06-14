// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { mount } from "@vue/test-utils"
import { defineComponent, h } from "vue"
import { describe, expect, it, vi } from "vitest"

vi.mock("vant", () => ({
  Rate: defineComponent({
    name: "Rate",
    props: {
      modelValue: Number,
      readonly: Boolean,
      disabled: Boolean,
    },
    emits: ["update:modelValue"],
    setup(props, { emit }) {
      return () =>
        h("button", { onClick: () => emit("update:modelValue", 3) }, String(props.modelValue))
    },
  }),
}))

import RateRenderer from "../index.vue"

describe("RateRenderer", () => {
  it("view 状态渲染只读 Rate 且不触发变更", async () => {
    const onChange = vi.fn()
    const wrapper = mount(RateRenderer, {
      props: {
        view: true,
        value: 4,
        onChange,
      },
    })

    const rate = wrapper.findComponent({ name: "Rate" })

    expect(rate.props("readonly")).toBe(true)
    await rate.vm.$emit("update:modelValue", 3)
    expect(onChange).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
