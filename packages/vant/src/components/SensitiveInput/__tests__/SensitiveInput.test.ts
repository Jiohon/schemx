// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import SensitiveInput from "../index.vue"

describe("SensitiveInput", () => {
  it("默认展示 maskFormatter 返回的脱敏值", () => {
    const wrapper = mount(SensitiveInput, {
      props: {
        value: "13812348899",
        maskFormatter: (value: string) => `${value.slice(0, 3)}****${value.slice(-4)}`,
      },
    })

    expect(wrapper.text()).toContain("138****8899")
    expect(wrapper.find("input").exists()).toBe(false)

    wrapper.unmount()
  })

  it("点击显示后渲染完整值输入框", async () => {
    const wrapper = mount(SensitiveInput, {
      attachTo: document.body,
      props: {
        value: "13812348899",
      },
    })

    await wrapper.get('[data-testid="sensitive-toggle"]').trigger("click")

    expect(wrapper.get("input").element.value).toBe("13812348899")
    expect(wrapper.text()).toContain("隐藏")

    wrapper.unmount()
  })

  it("输入修改后 onChange 回传真实值", async () => {
    const onChange = vi.fn()
    const wrapper = mount(SensitiveInput, {
      props: {
        value: "13812348899",
        onChange,
      },
    })

    await wrapper.get('[data-testid="sensitive-toggle"]').trigger("click")
    await wrapper.get("input").setValue("13900001111")

    expect(onChange).toHaveBeenCalledWith("13900001111")

    wrapper.unmount()
  })

  it("readonly 且允许展示时只显示完整值，不渲染输入框", async () => {
    const wrapper = mount(SensitiveInput, {
      props: {
        value: "secret-value",
        readonly: true,
        revealWhenReadonly: true,
      },
    })

    await wrapper.get('[data-testid="sensitive-toggle"]').trigger("click")

    expect(wrapper.text()).toContain("secret-value")
    expect(wrapper.find("input").exists()).toBe(false)

    wrapper.unmount()
  })

  it("disabled 时不能展示完整值", async () => {
    const wrapper = mount(SensitiveInput, {
      props: {
        value: "secret-value",
        disabled: true,
        maskFormatter: () => "******",
      },
    })

    expect(wrapper.find('[data-testid="sensitive-toggle"]').exists()).toBe(false)
    expect(wrapper.text()).toContain("******")
    expect(wrapper.text()).not.toContain("secret-value")

    wrapper.unmount()
  })
})
