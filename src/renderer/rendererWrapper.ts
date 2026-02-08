/**
 * createRenderWrapper - 渲染器包装工厂
 *
 * 可选的增强层，封装通用逻辑：
 * - 状态合并（readonly, disabled）
 * - 插槽合并（模板插槽和配置插槽）
 * - 默认属性合并
 * - 默认占位符生成
 *
 * 返回一个 Vue Component，可直接注册到 Registry。
 * 不使用 createRenderWrapper 的裸组件也可以直接注册。
 *
 * @module renderer/createRenderWrapper
 */

import {
  Component,
  defineComponent,
  h,
  type PropType,
  type SetupContext,
  Slots,
} from "vue"

import { useFormContext } from "../hooks/useFormContext"

import type { RendererType } from "../types"

/** 选择类组件类型 */
const SELECT_TYPES: RendererType[] = [
  "picker",
  "selector",
  "cascader",
  "date",
  "calendar",
  "radio",
  "checkbox",
]

// ==================== 工具函数 ====================

/**
 * 生成默认占位符文本
 */
function generateDefaultPlaceholder(
  componentType?: RendererType | string,
  label?: string
): string {
  const cleanLabel = label?.replace(/:$/, "") || ""

  return SELECT_TYPES.includes(componentType as RendererType)
    ? `请选择${cleanLabel}`
    : `请输入${cleanLabel}`
}

/**
 * 合并状态（OR 逻辑）
 */
function mergeState(...values: (boolean | undefined)[]): boolean {
  return values.some(Boolean)
}

// ==================== 类型定义 ====================

/** createRenderWrapper 选项 */
export interface CreateRenderWrapperOptions {
  /** 内部渲染器组件 */
  component: Component
  /** 默认属性 */
  defaultProps?: Record<string, unknown>
  /** 自定义占位符生成函数 */
  generatePlaceholder?: (componentType: string, label?: string) => string
}

// ==================== 插槽合并 ====================

/**
 * 合并插槽
 *
 * 从父级插槽中提取字段特定的插槽（fieldName:slotName 格式），
 * 然后与其他插槽合并。
 *
 * @param fieldName - 字段名
 * @param rendererSlots - 父级插槽
 * @returns 合并后的插槽对象
 */
function mergeSlots(fieldName: string, rendererSlots: Slots): Record<string, unknown> {
  const childRendererSlots: Record<string, unknown> = {}
  const childSlots: Record<string, unknown> = {}
  const prefix = `${fieldName}:`

  for (const [key, value] of Object.entries(rendererSlots)) {
    if (key.startsWith(prefix)) {
      const slotName = key.slice(prefix.length)
      childRendererSlots[slotName] = value
    } else {
      childSlots[key] = value
    }
  }

  return {
    ...childSlots,
    ...childRendererSlots,
  }
}

// ==================== 渲染器工厂 ====================

/**
 * 创建渲染器包装组件
 *
 * 返回一个 Vue Component，可直接注册到 Registry。
 * 内部处理状态合并、默认属性、占位符生成、插槽合并。
 *
 * @example
 * ```typescript
 * // 带默认属性的包装
 * const InputRenderer = createRenderWrapper({
 *   component: InputRendererComponent,
 *   defaultProps: { clearable: true, align: "left" },
 * })
 *
 * // 注册到 Registry
 * registry.register("input", InputRenderer)
 *
 * // 裸组件也可以直接注册，不需要包装
 * registry.register("calendar", CalendarRendererComponent)
 * ```
 */
export function createRenderWrapper(options: CreateRenderWrapperOptions): Component {
  const {
    component,
    defaultProps = {},
    generatePlaceholder: customGeneratePlaceholder = generateDefaultPlaceholder,
  } = options

  return defineComponent({
    name: "RendererWrapper",

    props: {
      name: {
        type: String,
        default: "",
      },
      class: {
        type: String,
        default: "",
      },
      value: {
        type: null as unknown as PropType<unknown>,
        default: undefined,
      },
      onChange: {
        type: Function as PropType<(value: unknown) => void>,
        default: undefined,
      },
      onBlur: {
        type: Function as PropType<() => void>,
        default: undefined,
      },
      readonly: {
        type: Boolean,
        default: undefined,
      },
      disabled: {
        type: Boolean,
        default: undefined,
      },
      placeholder: {
        type: String,
        default: undefined,
      },
      formItemProps: {
        type: Object as PropType<Record<string, unknown>>,
        default: () => ({}),
      },
    },

    setup(props, { slots }: SetupContext) {
      const context = useFormContext()

      return () => {
        const formItemProps = (props.formItemProps || {}) as Record<string, unknown>
        const componentProps = (formItemProps.componentProps || {}) as Record<
          string,
          unknown
        >

        // 合并状态：props > formItemProps > globalContext
        const mergedReadonly = mergeState(
          props.readonly,
          formItemProps.readonly as boolean | undefined,
          context?.readonly as boolean | undefined
        )
        const mergedDisabled = mergeState(
          props.disabled,
          formItemProps.disabled as boolean | undefined,
          context?.disabled as boolean | undefined
        )

        // 生成占位符
        const placeholder =
          props.placeholder ??
          (componentProps.placeholder as string | undefined) ??
          customGeneratePlaceholder(
            (formItemProps.componentType as string) || "",
            formItemProps.label as string | undefined
          )

        // 合并 props：defaultProps < componentProps < 直接 props
        const finalProps: Record<string, unknown> = {
          ...defaultProps,
          ...componentProps,
          value: props.value,
          onChange: props.onChange,
          onBlur: props.onBlur,
          readonly: mergedReadonly,
          disabled: mergedDisabled,
          placeholder,
          formItemProps,
          formInstance: context.form,
        }

        if (props.class) {
          finalProps.class = props.class
        }

        // 合并插槽
        const mergedSlots = mergeSlots(props.name, slots)

        return h(component, finalProps, mergedSlots)
      }
    },
  })
}

export { mergeSlots, mergeState, generateDefaultPlaceholder }

export default createRenderWrapper
