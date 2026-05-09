/**
 * useField error effect 集成测试
 *
 * 验证 useField 通过 signalEffect 桥接 core Signal → Vue shallowRef 的行为，
 * 确保错误状态在校验、手动设置、组件卸载等场景下正确同步。
 *
 * @remarks
 * 测试通过 defineComponent + mount 模拟真实 Vue 组件环境，
 * 使用 provide/inject 注入 SchemxInstance。
 */
import { defineComponent, h, nextTick } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import { useField } from "../useField"
import { SCHEMX_INSTANCE_KEY } from "../useForm"

import type { SchemxInstance } from "@schemx/core"

interface TestForm {
  name: string
  email: string
}

/**
 * 创建包含 useField 的测试组件
 *
 * @param fieldName - 要绑定的字段名
 * @param onSetup - setup 回调，接收 useField 返回值
 *
 * @returns Vue 组件定义
 */
function createFieldComponent(
  fieldName: string,
  onSetup: (field: ReturnType<typeof useField>) => void
) {
  return defineComponent({
    setup() {
      const field = useField<TestForm>(fieldName as any)

      onSetup(field)

      return () => h("div", `${fieldName}-field`)
    },
  })
}

/**
 * 挂载测试组件并注入表单实例
 *
 * @param form - SchemxInstance 实例
 * @param component - 要挂载的组件
 *
 * @returns @vue/test-utils 的 wrapper
 */
function mountWithForm(
  form: SchemxInstance<TestForm>,
  component: ReturnType<typeof defineComponent>
) {
  return mount(component, {
    global: {
      provide: {
        [SCHEMX_INSTANCE_KEY]: form,
      },
    },
  })
}

describe("useField error effect 集成测试", () => {
  it("setFieldError 后 fieldError ref 自动更新", async () => {
    const form = createForm<TestForm>({
      initialValues: { name: "", email: "" },
    })

    let fieldRef: ReturnType<typeof useField> | null = null

    const Comp = createFieldComponent("name", (field) => {
      fieldRef = field
    })

    mountWithForm(form, Comp)
    await nextTick()

    // 初始无错误
    expect(fieldRef!.error.value).toBeUndefined()

    // 手动设置错误
    form.setFieldError("name", ["名称不能为空"])
    await nextTick()

    expect(fieldRef!.error.value).toEqual(["名称不能为空"])
  })

  it("setFieldError 设置空数组后清除错误", async () => {
    const form = createForm<TestForm>({
      initialValues: { name: "", email: "" },
    })

    let fieldRef: ReturnType<typeof useField> | null = null

    const Comp = createFieldComponent("name", (field) => {
      fieldRef = field
    })

    mountWithForm(form, Comp)
    await nextTick()

    // 先设置错误
    form.setFieldError("name", ["必填"])
    await nextTick()
    expect(fieldRef!.error.value).toEqual(["必填"])

    // 清除错误
    form.setFieldError("name", [])
    await nextTick()
    expect(fieldRef!.error.value).toEqual([])
  })

  it("useField.setError / clearError 正确同步", async () => {
    const form = createForm<TestForm>({
      initialValues: { name: "", email: "" },
    })

    let fieldRef: ReturnType<typeof useField> | null = null

    const Comp = createFieldComponent("name", (field) => {
      fieldRef = field
    })

    mountWithForm(form, Comp)
    await nextTick()

    // 通过 useField 的 setError 设置
    fieldRef!.setError(["格式错误"])
    await nextTick()
    expect(fieldRef!.error.value).toEqual(["格式错误"])

    // 通过 useField 的 clearError 清除
    fieldRef!.clearError()
    await nextTick()
    expect(fieldRef!.error.value).toEqual([])
  })

  it("不同字段的错误互不影响", async () => {
    const form = createForm<TestForm>({
      initialValues: { name: "", email: "" },
    })

    let nameField: ReturnType<typeof useField> | null = null
    let emailField: ReturnType<typeof useField> | null = null

    const Comp = defineComponent({
      setup() {
        const nf = useField<TestForm>("name")
        const ef = useField<TestForm>("email")

        nameField = nf
        emailField = ef

        return () => h("div", [h("span", "name"), h("span", "email")])
      },
    })

    mountWithForm(form, Comp)
    await nextTick()

    // 只设置 name 的错误
    form.setFieldError("name", ["名称错误"])
    await nextTick()

    expect(nameField!.error.value).toEqual(["名称错误"])
    expect(emailField!.error.value).toBeUndefined()

    // 只设置 email 的错误
    form.setFieldError("email", ["邮箱格式不正确"])
    await nextTick()

    expect(nameField!.error.value).toEqual(["名称错误"])
    expect(emailField!.error.value).toEqual(["邮箱格式不正确"])
  })

  it("组件卸载后 error effect 被 dispose，不再同步", async () => {
    const form = createForm<TestForm>({
      initialValues: { name: "", email: "" },
    })

    let fieldRef: ReturnType<typeof useField> | null = null

    const Comp = createFieldComponent("name", (field) => {
      fieldRef = field
    })

    const wrapper = mountWithForm(form, Comp)
    await nextTick()

    // 设置错误确认同步正常
    form.setFieldError("name", ["错误1"])
    await nextTick()
    expect(fieldRef!.error.value).toEqual(["错误1"])

    // 保存引用后卸载组件
    const errorRef = fieldRef!.error

    wrapper.unmount()
    await nextTick()

    // 卸载后再设置错误，ref 不应更新
    form.setFieldError("name", ["错误2"])
    await nextTick()

    // effect 已 dispose，ref 保持卸载前的值
    expect(errorRef.value).toEqual(["错误1"])
  })

  it("字段值通过 signalEffect 自动同步到 getValue", async () => {
    const form = createForm<TestForm>({
      initialValues: { name: "初始值", email: "" },
    })

    let fieldRef: ReturnType<typeof useField> | null = null

    const Comp = createFieldComponent("name", (field) => {
      fieldRef = field
    })

    mountWithForm(form, Comp)
    await nextTick()

    // 初始值正确
    expect(fieldRef!.getValue()).toBe("初始值")

    // 通过 form 设置新值
    form.setFieldValue("name", "新值")
    await nextTick()

    expect(fieldRef!.getValue()).toBe("新值")
  })
})
