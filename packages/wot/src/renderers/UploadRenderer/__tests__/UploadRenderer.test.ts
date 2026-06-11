// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { defineComponent, h } from "vue"
import { describe, expect, it, vi } from "vitest"

vi.mock("@wot-ui/ui/components/wd-upload/wd-upload.vue", () => ({
  default: defineComponent({
    name: "wd-upload",
    props: ["fileList", "limit", "disabled", "autoUpload", "accept"],
    emits: ["update:file-list", "change", "remove"],
    setup(_props, { attrs }) {
      return () => [
        h("div", { class: "wd-upload-props-probe", ...attrs }),
        h("div", { class: "wd-upload-fragment-node" }),
      ]
    },
  }),
}))

import UploadRenderer from "../index.vue"

describe("UploadRenderer", () => {
  it("不把 Schemx 契约字段和内部 listener 透传给 Wot UI Upload", () => {
    const onChange = vi.fn()
    const onBlur = vi.fn()
    const wrapper = mount(UploadRenderer, {
      props: {
        value: [],
        valueModifiers: {},
        onChange,
        onBlur,
        className: "custom-upload",
        placeholder: "请选择文件",
        readonlyPlaceholder: "-",
        formItemProps: { disabled: false },
        deletable: true,
        accept: "image",
      } as any,
    })
    const upload = wrapper.find(".wd-upload-props-probe")

    expect(upload.attributes("placeholder")).toBeUndefined()
    expect(upload.attributes("valueModifiers")).toBeUndefined()
    expect(upload.attributes("readonlyPlaceholder")).toBeUndefined()
    expect(upload.attributes("formItemProps")).toBeUndefined()
    expect(upload.attributes("deletable")).toBeUndefined()
    expect(upload.attributes("onBlur")).toBeUndefined()

    wrapper.unmount()
  })
})
