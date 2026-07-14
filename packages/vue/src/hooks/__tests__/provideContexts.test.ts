import { defineComponent } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import { useFieldContext } from "../provideFieldContext"
import { useFormConfigContext } from "../provideFormConfigContext"
import { useFormContext } from "../provideFormContext"

const createConsumer = (consume: () => unknown) =>
  defineComponent({
    setup() {
      consume()
    },
    template: "<div />",
  })

const mountConsumer = (consume: () => unknown) =>
  mount(createConsumer(consume), {
    global: {
      config: {
        warnHandler: () => undefined,
      },
    },
  })

describe("provide/inject context hooks", () => {
  it("在缺少表单配置上下文时提供 setup 指引", () => {
    expect(() => mountConsumer(useFormConfigContext)).toThrow(
      "[schemx] useFormConfigContext() must be called inside a <SchemxForm> descendant. " +
        "Ensure createFormConfigContext(props) is called synchronously during setup()."
    )
  })

  it("在缺少表单实例上下文时提供 setup 指引", () => {
    expect(() => mountConsumer(useFormContext)).toThrow(
      "[schemx] useFormContext() must be called inside a <SchemxForm> descendant. " +
        "Ensure createFormContext(form) is called synchronously during setup()."
    )
  })

  it("在缺少字段上下文时说明所需的 provider", () => {
    expect(() => mountConsumer(useFieldContext)).toThrow(
      "[schemx] useFieldContext() must be called inside a component tree where " +
        "createFieldContext(field) has been called."
    )
  })
})
