// @vitest-environment happy-dom
/* eslint-disable vue/multi-word-component-names */

import { defineComponent, h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

vi.mock("@schemx/vue", () => ({
  useFieldContext: () => ({}),
}))

vi.mock("vant", () => ({
  Uploader: defineComponent({
    name: "Uploader",
    props: ["modelValue", "showUpload", "deletable", "disabled", "readonly", "maxCount"],
    emits: ["delete"],
    setup(props) {
      return () => h("div", JSON.stringify(props))
    },
  }),
}))

import UploadRenderer from "../index.vue"

describe("UploadRenderer", () => {
  it("view 状态禁上传、禁删除并只读展示文件列表", () => {
    const wrapper = mount(UploadRenderer, {
      props: {
        view: true,
        value: [{ url: "https://example.com/a.png" }],
      },
    })

    const uploader = wrapper.findComponent({ name: "Uploader" })

    expect(uploader.props("showUpload")).toBe(false)
    expect(uploader.props("deletable")).toBe(false)
    expect(uploader.props("readonly")).toBe(true)
    expect(uploader.props("disabled")).toBe(false)

    wrapper.unmount()
  })

  it("把 Uploader 原生属性从 props 透传给子组件", () => {
    const wrapper = mount(UploadRenderer, {
      props: {
        value: [],
        maxCount: 3,
        readonlyPlaceholder: "-",
        formItemProps: { name: "files" } as any,
        formInstance: {} as any,
      },
    })

    const uploader = wrapper.findComponent({ name: "Uploader" })

    expect(uploader.props("maxCount")).toBe(3)
    expect(uploader.attributes("readonly-placeholder")).toBeUndefined()
    expect(uploader.attributes("form-item-props")).toBeUndefined()
    expect(uploader.attributes("form-instance")).toBeUndefined()

    wrapper.unmount()
  })
})
