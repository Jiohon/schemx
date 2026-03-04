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
  computed,
  defineComponent,
  h,
  type PropType,
  type SetupContext,
  Slots,
} from "vue"

import type { ComponentsProps, NamePath, RendererType, SchemaBaseColumn } from "../types"

/** 选择类组件类型 */
const SELECT_TYPES: RendererType[] = []

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

/** createRenderWrapper 选项 */
export interface CreateRenderWrapperOptions {
  /** 内部渲染器组件 */
  component: Component
  /** 默认属性 */
  defaultProps?: ComponentsProps
  /** 自定义占位符生成函数 */
  generatePlaceholder?: (componentType?: RendererType | string, label?: string) => string
}

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
function mergeSlots(fieldName: NamePath, rendererSlots: Slots): Record<string, unknown> {
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
    generatePlaceholder: generatePlaceholder = generateDefaultPlaceholder,
  } = options

  return defineComponent({
    name: "RendererWrapper",

    props: {
      readonly: {
        type: Boolean,
        default: false,
      },
      disabled: {
        type: Boolean,
        default: false,
      },
      placeholder: {
        type: String,
        default: undefined,
      },
      componentsProps: {
        type: Object as PropType<ComponentsProps>,
        default: () => ({}),
      },
      formItemProps: {
        // type: Object as PropType<Record<string, any>>,
        type: Object as PropType<Partial<Omit<SchemaBaseColumn, "componentProps">>>,
        default: () => ({}),
      },
    },

    setup(props, { attrs, slots }: SetupContext) {
      return () => {
        const mergedProps = computed(() => {
          const defaultPlaceholder = generatePlaceholder?.(
            props.formItemProps?.componentType,
            props.formItemProps.label
          )

          return {
            ...defaultProps,
            ...props,
            ...attrs,
            placeholder: props.placeholder ?? defaultPlaceholder,
          }
        })

        // 合并插槽
        const mergedSlots = mergeSlots(props.formItemProps.name, slots)

        return h(component, mergedProps.value, mergedSlots)
      }
    },
  })
}

export { mergeSlots, generateDefaultPlaceholder }

export default createRenderWrapper
