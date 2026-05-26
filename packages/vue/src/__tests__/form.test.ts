import { defineComponent, h, markRaw, nextTick } from "vue"

import { createRendererRegistry } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import SchemxForm from "../form.vue"

const InputRenderer = defineComponent({
  name: "InputRenderer",
  setup() {
    return () => h("input", { "data-testid": "input-renderer" })
  },
})

describe("SchemxForm 动态 schemas", () => {
  it("外部 schemas prop 更新后同步 ViewSchemas", async () => {
    const rendererRegistry = createRendererRegistry()
    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        schemas: [
          { name: "name", label: "姓名", componentType: "input" },
        ],
      },
    })

    await nextTick()

    expect(wrapper.text()).toContain("姓名")
    expect(wrapper.text()).not.toContain("年龄")

    await wrapper.setProps({
      schemas: [
        { name: "name", label: "姓名", componentType: "input" },
        { name: "age", label: "年龄", componentType: "input" },
      ],
    })
    await nextTick()

    expect(wrapper.text()).toContain("姓名")
    expect(wrapper.text()).toContain("年龄")

    wrapper.unmount()
  })
})
