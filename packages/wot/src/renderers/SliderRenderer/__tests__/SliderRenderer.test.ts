// @vitest-environment happy-dom

import { shallowMount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import SliderRenderer from "../index.vue"

describe("SliderRenderer", () => {
  it("没有初始模型值时也给 Wot UI Slider 传入默认值", () => {
    const wrapper = shallowMount(SliderRenderer)
    const slider = wrapper.findComponent({ name: "wd-slider" })

    expect(slider.props("modelValue")).toBe(0)

    wrapper.unmount()
  })

  it("不把 Schemx 的 onChange 透传给 Wot UI Slider", () => {
    const onChange = vi.fn()
    const wrapper = shallowMount(SliderRenderer, {
      props: {
        onChange,
      },
    })
    const slider = wrapper.findComponent({ name: "wd-slider" })

    expect(slider.props("onChange")).toBeUndefined()

    wrapper.unmount()
  })

  it("不会把 Wot UI Slider 的 change 事件直接桥接成 Schemx onChange", async () => {
    const onChange = vi.fn()
    const wrapper = shallowMount(SliderRenderer, {
      props: {
        onChange,
      },
    })

    await wrapper.findComponent({ name: "wd-slider" }).vm.$emit("change", 20)

    expect(onChange).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it("桥接 Schemx 的 value 更新契约", async () => {
    const onChange = vi.fn()
    const wrapper = shallowMount(SliderRenderer, {
      props: {
        value: 10,
        onChange,
      },
    })

    await wrapper.findComponent({ name: "wd-slider" }).vm.$emit("update:modelValue", 20)

    expect(onChange).toHaveBeenCalledWith(20)
    expect(wrapper.emitted("update:value")?.[0]).toEqual([20])

    wrapper.unmount()
  })
})
