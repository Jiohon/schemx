// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import Cell from "../index.vue"

const WdCellStub = {
  name: "WdCell",
  props: {
    value: [String, Number],
    placeholder: String,
    isLink: Boolean,
    clickable: Boolean,
    disabled: Boolean,
    valueAlign: String,
    customValueClass: String,
  },
  template: `
    <div
      class="wd-cell"
      :class="{ 'wd-cell--disabled': disabled, 'wd-cell--link': isLink }"
    >
      <span class="wd-cell__value" :class="customValueClass">{{ value || placeholder }}</span>
    </div>
  `,
}

const mountCell = (props = {}) =>
  mount(Cell, {
    props,
    global: {
      stubs: {
        WdCell: WdCellStub,
      },
    },
  })

describe("Cell 状态展示", () => {
  it("editable 状态显示右箭头并开启点击反馈", () => {
    const wrapper = mountCell({ value: "选项 A" })
    const cell = wrapper.getComponent(WdCellStub)

    expect(cell.props("isLink")).toBe(true)
    expect(cell.props("clickable")).toBe(true)
    expect(cell.props("disabled")).toBe(false)
  })

  it("disabled 状态置灰且不显示右箭头", () => {
    const wrapper = mountCell({ value: "选项 A", disabled: true })
    const cell = wrapper.getComponent(WdCellStub)

    expect(cell.props("isLink")).toBe(false)
    expect(cell.props("clickable")).toBe(false)
    expect(cell.props("disabled")).toBe(true)
    expect(cell.props("customValueClass")).toContain("schemx-cell__value--disabled")
  })

  it("readonly 状态不显示右箭头，并使用轻量只读颜色", () => {
    const wrapper = mountCell({ value: "选项 A", readonly: true })
    const cell = wrapper.getComponent(WdCellStub)

    expect(cell.props("isLink")).toBe(false)
    expect(cell.props("clickable")).toBe(false)
    expect(cell.props("disabled")).toBe(false)
    expect(cell.props("customValueClass")).toContain("schemx-cell__value--readonly")
    expect(cell.props("customValueClass")).not.toContain("schemx-cell__value--disabled")
  })

  it("view 状态作为纯详情项展示", () => {
    const wrapper = mountCell({ value: "详情文本", view: true })
    const cell = wrapper.getComponent(WdCellStub)

    expect(cell.props("isLink")).toBe(false)
    expect(cell.props("clickable")).toBe(false)
    expect(cell.props("disabled")).toBe(false)
    expect(cell.props("customValueClass")).not.toContain("schemx-cell__value--disabled")
  })

  it("不再通过 status 字段切换展示状态", () => {
    const wrapper = mountCell({ value: "详情文本", status: "view" })
    const cell = wrapper.getComponent(WdCellStub)

    expect(cell.props("isLink")).toBe(true)
    expect(cell.props("clickable")).toBe(true)
    expect(cell.props("disabled")).toBe(false)
    expect(cell.props("customValueClass")).not.toContain("schemx-cell__value--view")
  })
})
