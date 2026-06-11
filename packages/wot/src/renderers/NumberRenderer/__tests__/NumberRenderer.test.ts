// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import NumberRenderer from "../index.vue"

describe("NumberRenderer 组件归属", () => {
  it("数字输入使用 Wot UI 的 wd-input 组件渲染并默认使用 number 类型", () => {
    const wrapper = mount(NumberRenderer, {
      props: {
        value: 1,
      },
    })

    const input = wrapper.findComponent({ name: "wd-input" })

    expect(input.exists()).toBe(true)
    expect(input.props("type")).toBe("number")
    expect(wrapper.find(".wd-input-number").exists()).toBe(false)

    wrapper.unmount()
  })

  it("允许将数字输入类型切换为 digit", () => {
    const wrapper = mount(NumberRenderer, {
      props: {
        value: "1.5",
        type: "digit",
      },
    })

    const input = wrapper.findComponent({ name: "wd-input" })

    expect(input.props("type")).toBe("digit")

    wrapper.unmount()
  })
})
