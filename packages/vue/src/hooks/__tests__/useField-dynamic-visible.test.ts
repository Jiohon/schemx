/**
 * useField 动态 visible 字段 error effect 集成测试
 *
 * 复现 DynamicForm 场景：
 * 1. FormItem 挂载时 useField 创建 disposeErrorEffect
 * 2. 字段初始不可见 → unregisterRules → errors.delete
 * 3. 字段变为可见 → registerRules
 * 4. validate() → errors 更新
 * 5. 验证 disposeErrorEffect 是否正确同步错误到 Vue ref
 *
 * @remarks
 * 模拟 FormItem 中 watch([canVerified]) 的注册/注销 rules 生命周期，
 * 以及 resolveDynamicPropBatch 的异步 debounce 行为。
 */
import { computed, defineComponent, h, nextTick, ref, watch } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { useField } from "../useField"
import { SCHEMX_INSTANCE_KEY } from "../useForm"

import type { SchemxInstance } from "@schemx/core"

interface DynamicForm {
  userType: string
  companyName: string
}

/**
 * 模拟 FormItem 的动态 visible 行为
 *
 * 复现 FormItem 中的关键逻辑：
 * - useField 创建 error effect
 * - watch([canVerified]) 控制 registerRules/unregisterRules
 * - visible 变化时的规则注册/注销
 */
function createDynamicFieldComponent(
  fieldName: string,
  options: {
    visibleFn: (form: SchemxInstance<DynamicForm>) => boolean
    rules: any
    defaultMessage: string
    onSetup?: (field: ReturnType<typeof useField>) => void
  }
) {
  return defineComponent({
    setup() {
      const form = useField<DynamicForm>(fieldName as any)

      options.onSetup?.(form)

      // 模拟 FormItem 的 resolvedVisible（同步版本，不用 debounce）
      const resolvedVisible = ref(options.visibleFn(form.form))

      // 模拟 canVerified
      const canVerified = computed(() => resolvedVisible.value)

      // 模拟 FormItem 的 watch([canVerified])
      watch(
        [canVerified],
        () => {
          if (!canVerified.value) {
            form.clearError()
            form.unregisterRules()
          } else {
            form.registerRules(options.rules, options.defaultMessage)
          }
        },
        { immediate: true }
      )

      // 暴露 resolvedVisible 以便测试中修改
      return () => {
        if (!resolvedVisible.value) return null

        return h("div", `${fieldName}: ${form.error.value?.join(", ") ?? "no error"}`)
      }
    },
  })
}

describe("useField 动态 visible 字段 error effect", () => {
  it("同步 visible 切换 + validate 后 error 应正确同步", async () => {
    const form = createForm<DynamicForm>({
      initialValues: { userType: "personal", companyName: "" },
    })

    let fieldRef: ReturnType<typeof useField> | null = null

    // 模拟 companyName 字段：visible 取决于 userType === "enterprise"
    const Comp = defineComponent({
      setup() {
        const field = useField<DynamicForm>("companyName")
        fieldRef = field

        const resolvedVisible = ref(false) // 初始不可见

        const canVerified = computed(() => resolvedVisible.value)

        watch(
          [canVerified],
          () => {
            if (!canVerified.value) {
              field.clearError()
              field.unregisterRules()
            } else {
              field.registerRules(
                z.string().min(2, "企业名称至少2个字符"),
                "请输入企业名称"
              )
            }
          },
          { immediate: true }
        )

        // 暴露 resolvedVisible 供外部修改
        ;(field as any).__resolvedVisible = resolvedVisible

        return () =>
          h("div", resolvedVisible.value ? `error: ${field.error.value}` : "hidden")
      },
    })

    const wrapper = mount(Comp, {
      global: {
        provide: { [SCHEMX_INSTANCE_KEY]: form },
      },
    })

    await nextTick()

    // 初始状态：不可见，无错误
    expect(fieldRef!.error.value).toBeUndefined()

    // 模拟 userType 切换为 enterprise → visible 变为 true
    const resolvedVisible = (fieldRef as any).__resolvedVisible
    resolvedVisible.value = true
    await nextTick()

    // 现在 canVerified 为 true，rules 已注册
    // 调用 validate
    const result = await form.validate()
    await nextTick()

    console.log("validate result:", result)
    console.log("fieldRef error:", fieldRef!.error.value)
    console.log("form.getFieldError:", form.getFieldError("companyName"))

    // 关键断言：error 应该同步到 Vue ref
    expect(result.ok).toBe(false)
    expect(form.getFieldError("companyName")).toBeDefined()
    expect(form.getFieldError("companyName")!.length).toBeGreaterThan(0)

    // 这是 bug 的核心：disposeErrorEffect 是否将错误同步到了 fieldError ref
    expect(fieldRef!.error.value).toBeDefined()
    expect(fieldRef!.error.value!.length).toBeGreaterThan(0)

    wrapper.unmount()
    form.destroy()
  })

  it("异步 visible 切换（模拟 debounce）+ validate 后 error 应正确同步", async () => {
    const form = createForm<DynamicForm>({
      initialValues: { userType: "personal", companyName: "" },
    })

    let fieldRef: ReturnType<typeof useField> | null = null

    const Comp = defineComponent({
      setup() {
        const field = useField<DynamicForm>("companyName")
        fieldRef = field

        const resolvedVisible = ref(false)
        const canVerified = computed(() => resolvedVisible.value)

        watch(
          [canVerified],
          () => {
            if (!canVerified.value) {
              field.clearError()
              field.unregisterRules()
            } else {
              field.registerRules(
                z.string().min(2, "企业名称至少2个字符"),
                "请输入企业名称"
              )
            }
          },
          { immediate: true }
        )
        ;(field as any).__resolvedVisible = resolvedVisible

        return () => h("div", "test")
      },
    })

    const wrapper = mount(Comp, {
      global: {
        provide: { [SCHEMX_INSTANCE_KEY]: form },
      },
    })

    await nextTick()

    // 模拟 debounce 延迟后 visible 变为 true
    const resolvedVisible = (fieldRef as any).__resolvedVisible

    // 使用 setTimeout 模拟 resolveDynamicPropBatch 的 16ms debounce
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolvedVisible.value = true
        resolve()
      }, 20)
    })

    await nextTick()
    await nextTick()

    // validate
    const result = await form.validate()
    await nextTick()

    console.log("async test - validate result:", result)
    console.log("async test - fieldRef error:", fieldRef!.error.value)

    expect(result.ok).toBe(false)
    expect(fieldRef!.error.value).toBeDefined()
    expect(fieldRef!.error.value!.length).toBeGreaterThan(0)

    wrapper.unmount()
    form.destroy()
  })

  it("多次 visible 切换后 validate 仍应正确同步 error", async () => {
    const form = createForm<DynamicForm>({
      initialValues: { userType: "personal", companyName: "" },
    })

    let fieldRef: ReturnType<typeof useField> | null = null

    const Comp = defineComponent({
      setup() {
        const field = useField<DynamicForm>("companyName")
        fieldRef = field

        const resolvedVisible = ref(false)
        const canVerified = computed(() => resolvedVisible.value)

        watch(
          [canVerified],
          () => {
            if (!canVerified.value) {
              field.clearError()
              field.unregisterRules()
            } else {
              field.registerRules(
                z.string().min(2, "企业名称至少2个字符"),
                "请输入企业名称"
              )
            }
          },
          { immediate: true }
        )
        ;(field as any).__resolvedVisible = resolvedVisible

        return () => h("div", "test")
      },
    })

    const wrapper = mount(Comp, {
      global: {
        provide: { [SCHEMX_INSTANCE_KEY]: form },
      },
    })

    await nextTick()

    const resolvedVisible = (fieldRef as any).__resolvedVisible

    // 切换多次：false → true → false → true
    resolvedVisible.value = true
    await nextTick()
    resolvedVisible.value = false
    await nextTick()
    resolvedVisible.value = true
    await nextTick()

    // validate
    const result = await form.validate()
    await nextTick()

    expect(result.ok).toBe(false)
    expect(fieldRef!.error.value).toBeDefined()
    expect(fieldRef!.error.value!.length).toBeGreaterThan(0)

    wrapper.unmount()
    form.destroy()
  })
})
