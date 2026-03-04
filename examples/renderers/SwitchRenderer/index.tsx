import { computed, defineComponent, PropType, ref, SetupContext } from "vue"

import { Switch } from "vant"

import classNames from "classnames"

import { createRenderWrapper } from "@/renderer/rendererWrapper"
import { getFieldProps } from "@/utils"
import "./index.scss"

export interface SwitchRendererProps {
  value?: boolean | string | number
  onChange?: (
    value: boolean | string | number
  ) => void | Promise<boolean | string | number | void>
  className?: string
  activeText?: string
  activeValue?: boolean | string | number
  inactiveValue?: boolean | string | number
  inactiveText?: string
  readonly?: boolean
  readonlyPlaceholder?: string
  disabled?: boolean
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  error?: string[]
}

/**
 * 开关渲染器组件
 * 支持自定义开关状态文本
 * 完整继承 vant Switch 组件的所有功能
 *
 * - Requirement 13.3: THE migrated renderers SHALL support the new state merging logic
 * - Requirement 13.4: THE migrated renderers SHALL support the new slot merging logic
 * - Requirement 13.5: THE migrated renderers SHALL maintain backward compatibility with existing componentProps
 */
const SwitchRendererComponent = defineComponent({
  name: "SwitchRendererComponent",
  props: {
    value: {
      type: [Boolean, String, Number] as PropType<boolean | string | number>,
      default: false,
    },
    onChange: {
      type: Function as PropType<
        (
          value: boolean | string | number
        ) => void | Promise<boolean | string | number | void>
      >,
      default: () => {},
    },
    className: {
      type: String,
      default: "",
    },
    activeText: {
      type: String,
      default: undefined,
    },
    activeValue: {
      type: [Boolean, String, Number] as PropType<boolean | string | number>,
      default: true,
    },
    inactiveValue: {
      type: [Boolean, String, Number] as PropType<boolean | string | number>,
      default: false,
    },
    inactiveText: {
      type: String,
      default: undefined,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    readonlyPlaceholder: {
      type: String,
      default: "-",
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    formItemProps: {
      type: Object as PropType<Record<string, any>>,
      default: () => ({}),
    },
    formInstance: {
      type: Object as PropType<Record<string, any> | null>,
      default: null,
    },
    error: {
      type: Array as PropType<string[]>,
      default: undefined,
    },
  },
  setup(props, { attrs }: SetupContext) {
    const loading = ref(false)

    const disabled = computed(() => props.disabled || props.formItemProps?.disabled)
    const readonly = computed(() => props.readonly || props.formItemProps?.readonly)

    const fieldValue = computed(() => {
      return props.value === props.activeValue ? props.activeText : props.inactiveText
    })

    const handleChange = async (value: boolean | string | number): Promise<void> => {
      if (readonly.value || disabled.value) return

      try {
        loading.value = true

        const result = await props.onChange?.(value)

        if (result === props.activeValue) {
          props.formInstance?.setFieldValue(props.formItemProps.name, props.activeValue)
        }

        if (result === props.inactiveValue) {
          props.formInstance?.setFieldValue(props.formItemProps.name, props.inactiveValue)
        }

        loading.value = false
      } catch (error) {
        loading.value = false
      }
    }

    return () => {
      if (readonly.value) {
        return (
          <div
            class={classNames("schema-form-switch-renderer", props.className)}
            style={{
              justifyContent: getFieldProps(
                attrs as Record<string, any>,
                "align",
                "right"
              ),
            }}
          >
            {readonly.value ? props.readonlyPlaceholder : fieldValue.value}
          </div>
        )
      }

      return (
        <div
          class={classNames(
            "schema-form-renderer",
            "schema-form-switch-renderer",
            props.className,
            {
              "schema-form-renderer-readonly": readonly.value,
              "schema-form-renderer-disabled": disabled.value,
            }
          )}
          style={{
            justifyContent: getFieldProps(attrs as Record<string, any>, "align", "right"),
          }}
        >
          <Switch
            size="22px"
            onUpdate:modelValue={handleChange}
            {...attrs}
            modelValue={props.value}
            loading={loading.value}
            disabled={disabled.value}
          />
        </div>
      )
    }
  },
})

/**
 * SwitchRenderer - 使用 createRenderWrapper 工厂函数创建的开关渲染器
 *
 * 通过 createRenderWrapper 包装 SwitchRendererComponent，提供：
 * - 状态合并（readonly, disabled）从 props、formItemProps 和 formContext
 * - 插槽合并（模板插槽和配置插槽）
 * - 值绑定（value, onChange）
 * - 错误显示
 * - 默认占位符生成
 *
 * - Requirement 13.3: THE migrated renderers SHALL support the new state merging logic
 * - Requirement 13.4: THE migrated renderers SHALL support the new slot merging logic
 * - Requirement 13.5: THE migrated renderers SHALL maintain backward compatibility with existing componentProps
 */
// 导出原始组件（用于向后兼容）
export { SwitchRendererComponent }

// 默认导出原始组件以保持向后兼容性
export default SwitchRendererComponent

// 导出包装后的渲染器（用于 RendererRegistry 注册）
export const SwitchRendererWrapped = createRenderWrapper({
  component: SwitchRendererComponent,
  defaultProps: {
    align: "right",
  },
})
