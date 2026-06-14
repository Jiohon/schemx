// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { mount } from "@vue/test-utils"
import { defineComponent, h } from "vue"
import { describe, expect, it, vi } from "vitest"

vi.mock("vant", () => ({
  RadioGroup: defineComponent({
    name: "RadioGroup",
    props: ["modelValue"],
    emits: ["update:modelValue"],
    setup(_, { slots }) {
      return () => h("div", slots.default?.())
    },
  }),
  Radio: defineComponent({
    name: "Radio",
    props: ["name", "disabled"],
    setup(_, { slots }) {
      return () => h("label", slots.default?.())
    },
  }),
}))

import RadioRenderer from "../index.vue"

describe("RadioRenderer", () => {
  it("view 状态展示选中项文本且不渲染 RadioGroup", () => {
    const wrapper = mount(RadioRenderer, {
      props: {
        view: true,
        value: "female",
        options: [{ label: "女", value: "female" }],
      },
    })

    expect(wrapper.text()).toContain("女")
    expect(wrapper.findComponent({ name: "RadioGroup" }).exists()).toBe(false)

    wrapper.unmount()
  })
})
