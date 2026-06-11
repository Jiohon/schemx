// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import InputRenderer from "../index.vue"

describe("InputRenderer", () => {
  it("使用 Wot UI 的 wd-input 组件渲染", () => {
    const wrapper = mount(InputRenderer)

    expect(wrapper.find(".wd-input").exists()).toBe(true)
    expect(wrapper.find(".wd-input__inner").exists()).toBe(true)

    wrapper.unmount()
  })

  it("字数统计属性通过 v-bind 交给 Wot UI Input", () => {
    const wrapper = mount(InputRenderer, {
      props: {
        maxlength: 20,
        showWordLimit: true,
      },
    })

    const input = wrapper.findComponent({ name: "wd-input" })

    expect(input.props("maxlength")).toBe(20)
    expect(input.props("showWordLimit")).toBe(true)

    wrapper.unmount()
  })

  it("桥接 Schemx 的 value 更新契约", async () => {
    const onChange = vi.fn()
    const wrapper = mount(InputRenderer, {
      props: {
        value: "old",
        onChange,
      },
    })

    await wrapper.findComponent({ name: "wd-input" }).vm.$emit("update:modelValue", "new")

    expect(onChange).toHaveBeenCalledWith("new")
    expect(wrapper.emitted("update:value")?.[0]).toEqual(["new"])
    expect(wrapper.emitted("change")?.[0]).toEqual(["new"])

    wrapper.unmount()
  })
})
