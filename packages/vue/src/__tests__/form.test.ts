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

const SelectorRenderer = defineComponent({
  name: "SelectorRenderer",
  props: {
    value: String,
    onChange: Function,
  },
  setup(props) {
    return () =>
      h("button", {
        "data-testid": "selector-renderer",
        type: "button",
        onClick: () => props.onChange?.("express"),
      })
  },
})

const CountRenderer = defineComponent({
  name: "CountRenderer",
  props: {
    count: Number,
  },
  setup(props) {
    return () =>
      h("div", {
        "data-testid": "count-renderer",
        "data-count": String(props.count),
      })
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
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(wrapper.text()).toContain("姓名")
    expect(wrapper.text()).toContain("年龄")

    wrapper.unmount()
  })

  it("dependency 切换到嵌套 group 分支后渲染新增 children", async () => {
    const rendererRegistry = createRendererRegistry()
    rendererRegistry.register("selector", markRaw(SelectorRenderer))
    rendererRegistry.register("stepper", markRaw(InputRenderer))
    rendererRegistry.register("slider", markRaw(InputRenderer))
    let dependencyCalls = 0

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        initialValues: { orderType: "standard" },
        schemas: [
          {
            name: "orderType",
            label: "订单类型",
            componentType: "selector",
          },
          {
            componentType: "dependency",
            to: ["orderType"],
            renderer: (values: any) => {
              dependencyCalls += 1

              if (values.orderType === "standard") {
                return [
                  {
                    label: "标准订单配置",
                    componentType: "group",
                    children: [
                      {
                        name: "quantity",
                        label: "数量",
                        componentType: "stepper",
                      },
                    ],
                  },
                ]
              }

              if (values.orderType !== "express") {
                return []
              }

              return [
                {
                  label: "加急订单配置",
                  componentType: "group",
                  children: [
                    {
                      name: "expressLevel",
                      label: "加急等级",
                      componentType: "selector",
                      initialValue: "priority",
                    },
                    {
                      componentType: "dependency",
                      to: ["expressLevel"],
                      renderer: (expressValues: any) => {
                        if (expressValues.expressLevel !== "priority") {
                          return []
                        }

                        return [
                          {
                            name: "expressFee",
                            label: "加急费用",
                            componentType: "slider",
                          },
                        ]
                      },
                    },
                  ],
                },
              ]
            },
          },
        ],
      },
    })

    await nextTick()
    await (wrapper.vm as any).waitForDependencies()
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect((wrapper.vm as any).getFieldValue("orderType")).toBe("standard")
    expect(dependencyCalls).toBeGreaterThan(0)
    expect((wrapper.vm as any).getViewSchemas()).toMatchObject([
      { name: "orderType" },
      {
        componentType: "group",
        label: "标准订单配置",
        children: [{ name: "quantity" }],
      },
    ])
    expect(wrapper.text()).toContain("标准订单配置")
    expect(wrapper.text()).toContain("数量")

    await wrapper.get('[data-testid="selector-renderer"]').trigger("click")
    await (wrapper.vm as any).waitForDependencies()
    await new Promise((resolve) => setTimeout(resolve, 30))
    await nextTick()

    expect(wrapper.text()).toContain("加急订单配置")
    expect(wrapper.text()).toContain("加急等级")
    expect(wrapper.text()).toContain("加急费用")

    wrapper.unmount()
  })

  it("dependencies.componentProps 更新后应同步下发给已挂载 renderer", async () => {
    const rendererRegistry = createRendererRegistry()
    rendererRegistry.register("input", markRaw(InputRenderer))
    rendererRegistry.register("rate", markRaw(CountRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        initialValues: { deliveryMethod: "express" },
        schemas: [
          {
            name: "deliveryMethod",
            label: "配送方式",
            componentType: "input",
          },
          {
            name: "serviceRating",
            label: "服务评分",
            componentType: "rate",
            dependencies: {
              triggerFields: ["deliveryMethod"],
              componentProps: (values: any) => {
                const countMap: Record<string, number> = {
                  express: 5,
                  selfPickup: 3,
                  other: 7,
                }

                return {
                  count: countMap[values.deliveryMethod as string] ?? 5,
                }
              },
            },
          },
        ],
      },
    })

    await nextTick()
    await (wrapper.vm as any).waitForDependencies()
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(wrapper.get('[data-testid="count-renderer"]').attributes("data-count")).toBe(
      "5"
    )

    ;(wrapper.vm as any).setFieldValue("deliveryMethod", "selfPickup")
    await (wrapper.vm as any).waitForDependencies()
    await new Promise((resolve) => setTimeout(resolve, 30))
    await nextTick()

    expect(wrapper.get('[data-testid="count-renderer"]').attributes("data-count")).toBe(
      "3"
    )

    wrapper.unmount()
  })

  it("只按顶层可见非 group 字段标记首尾样式类", async () => {
    const rendererRegistry = createRendererRegistry()
    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        schemas: [
          {
            componentType: "group",
            label: "分组一",
            children: [{ name: "city", label: "城市", componentType: "input" }],
          },
          { name: "name", label: "姓名", componentType: "input" },
          {
            componentType: "group",
            label: "分组二",
            children: [{ name: "street", label: "街道", componentType: "input" }],
          },
          { name: "age", label: "年龄", componentType: "input" },
        ],
      },
    })

    await nextTick()

    const root = wrapper.get(".schemx").element
    const directItemWrappers = Array.from(root.children).filter((element) =>
      element.classList.contains("schemx-item-wrapper")
    )

    expect(directItemWrappers).toHaveLength(2)
    expect(directItemWrappers[0].classList.contains("schemx-item-wrapper--first")).toBe(
      true
    )
    expect(directItemWrappers[0].classList.contains("schemx-item-wrapper--last")).toBe(
      false
    )
    expect(directItemWrappers[1].classList.contains("schemx-item-wrapper--first")).toBe(
      false
    )
    expect(directItemWrappers[1].classList.contains("schemx-item-wrapper--last")).toBe(
      true
    )

    const groupItemWrappers = wrapper.findAll(".schemx-group__body .schemx-item-wrapper")
    expect(groupItemWrappers).toHaveLength(2)
    for (const itemWrapper of groupItemWrappers) {
      expect(itemWrapper.classes()).not.toContain("schemx-item-wrapper--first")
      expect(itemWrapper.classes()).not.toContain("schemx-item-wrapper--last")
    }

    wrapper.unmount()
  })

  it("查找首尾样式类时跳过当前项前后的 group 和不可见字段", async () => {
    const rendererRegistry = createRendererRegistry()
    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        schemas: [
          {
            componentType: "group",
            label: "前置分组",
            children: [{ name: "city", label: "城市", componentType: "input" }],
          },
          { name: "hiddenBefore", label: "隐藏前项", componentType: "input", visible: false },
          { name: "name", label: "姓名", componentType: "input" },
          {
            componentType: "group",
            label: "中间分组",
            children: [{ name: "street", label: "街道", componentType: "input" }],
          },
          { name: "age", label: "年龄", componentType: "input" },
          { name: "hiddenAfter", label: "隐藏后项", componentType: "input", visible: false },
          {
            componentType: "group",
            label: "后置分组",
            children: [{ name: "postcode", label: "邮编", componentType: "input" }],
          },
        ],
      },
    })

    await nextTick()

    const root = wrapper.get(".schemx").element
    const directItemWrappers = Array.from(root.children).filter((element) =>
      element.classList.contains("schemx-item-wrapper")
    )

    expect(directItemWrappers).toHaveLength(2)
    expect(directItemWrappers[0].classList.contains("schemx-item-wrapper--first")).toBe(
      true
    )
    expect(directItemWrappers[0].classList.contains("schemx-item-wrapper--last")).toBe(
      false
    )
    expect(directItemWrappers[1].classList.contains("schemx-item-wrapper--first")).toBe(
      false
    )
    expect(directItemWrappers[1].classList.contains("schemx-item-wrapper--last")).toBe(
      true
    )

    wrapper.unmount()
  })
})
