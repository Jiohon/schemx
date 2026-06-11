// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import TextAreaRenderer from "../index.vue"

describe("TextAreaRenderer 组件归属", () => {
  it("文本域输入使用 Wot UI 的 wd-textarea 组件渲染", () => {
    const wrapper = mount(TextAreaRenderer)

    expect(wrapper.find(".wd-textarea").exists()).toBe(true)
    expect(wrapper.find(".wd-textarea__inner").exists()).toBe(true)

    wrapper.unmount()
  })
})
