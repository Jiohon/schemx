// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import RateRenderer from "../index.vue"

describe("RateRenderer", () => {
  it("没有初始值时也给 Wot UI 评分组件传入可渲染的默认值", () => {
    const wrapper = mount(RateRenderer)
    const rate = wrapper.findComponent({ name: "wd-rate" })

    expect(rate.exists()).toBe(true)
    expect(rate.props("modelValue")).toBe(0)
    expect(rate.props("num")).toBe(5)

    wrapper.unmount()
  })

  it("桥接 Schemx 的 value 更新契约", async () => {
    const onChange = vi.fn()
    const wrapper = mount(RateRenderer, {
      props: {
        value: 1,
        onChange,
      },
    })

    await wrapper.findComponent({ name: "wd-rate" }).vm.$emit("update:modelValue", 3)

    expect(onChange).toHaveBeenCalledWith(3)
    expect(wrapper.emitted("update:value")?.[0]).toEqual([3])

    wrapper.unmount()
  })

  it("不把 Schemx 的 onChange 透传给 Wot UI Rate", async () => {
    const onChange = vi.fn()
    const wrapper = mount(RateRenderer, {
      props: {
        onChange,
      },
    })
    const rate = wrapper.findComponent({ name: "wd-rate" })

    expect(rate.props("onChange")).toBeUndefined()

    await rate.vm.$emit("change", { value: 3 })

    expect(onChange).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
