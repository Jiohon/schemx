import { computed, defineComponent, PropType, SetupContext } from "vue"

import { Checkbox, CheckboxGroup } from "vant"

import classNames from "classnames"

import { createRenderWrapper } from "@/renderer/rendererWrapper"
import { getFieldProps } from "@/utils"
import "./index.scss"

export interface CheckboxOption {
  label?: string
  value?: string | number | boolean
  disabled?: boolean
  [key: string]: any
}

export interface CheckboxRendererProps {
  value?: any[]
  onChange?: (value: any[]) => void
  options?: CheckboxOption[]
  fieldNames?: {
    label?: string
    value?: string
    disabled?: string
  }
  className?: string
  readonly?: boolean
  readonlyPlaceholder?: string
  disabled?: boolean
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  error?: string[]
}

/**
 * 复选框渲染器组件
 * 支持多选功能
 * 完整继承 Vant Checkbox 组件的所有功能
 *
 * - Requirement 13.3: THE migrated renderers SHALL support the new state merging logic
 * - Requirement 13.4: THE migrated renderers SHALL support the new slot merging logic
 * - Requirement 13.5: THE migrated renderers SHALL maintain backward compatibility with existing componentProps
 */
const CheckboxRendererComponent = defineComponent({
  name: "CheckboxRendererComponent",
  props: {
    value: {
      type: Array as PropType<any[]>,
      default: () => [],
    },
    onChange: {
      type: Function as PropType<(value: any[]) => void>,
      default: () => {},
    },
    options: {
      type: Array as PropType<CheckboxOption[]>,
      default: () => [],
    },
    fieldNames: {
      type: Object as PropType<{ label?: string; value?: string; disabled?: string }>,
      default: () => ({}),
    },
    className: {
      type: String,
      default: "",
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
    const labelName = computed(() => props.fieldNames?.label || "label")
    const valueName = computed(() => props.fieldNames?.value || "value")
    const disabledName = computed(() => props.fieldNames?.disabled || "disabled")

    const disabled = computed(
      () => (attrs as Record<string, any>)?.disabled || props.formItemProps?.disabled
    )
    const readonly = computed(
      () => (attrs as Record<string, any>)?.readonly || props.formItemProps?.readonly
    )

    const modelValue = computed(() => {
      if (!props.value) return []

      return typeof props.value === "string"
        ? (props.value as string).split(",")
        : props.value
    })

    const fieldValue = computed(() => {
      return modelValue.value
        ?.map((v: any) => {
          return getOption(v, labelName.value)
        })
        .join("、")
    })

    const getOption = (v: any, key: string): any => {
      const option = props.options.find((option) => option[valueName.value] === v)

      return option ? option[key] : v
    }

    return () => {
      if (readonly.value) {
        return (
          <div
            class={classNames("schema-form-checkbox-renderer", props.className)}
            style={{
              textAlign: getFieldProps(attrs as Record<string, any>, "align", "right"),
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
            "schema-form-checkbox-renderer",
            props.className,
            {
              "schema-form-renderer-disabled": disabled.value,
              "schema-form-renderer-readonly": readonly.value,
            }
          )}
        >
          <CheckboxGroup
            {...attrs}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px 12px",
              justifyContent: getFieldProps(
                attrs as Record<string, any>,
                "align",
                "right"
              ),
              ...((attrs as Record<string, any>)?.style || {}),
            }}
            disabled={disabled.value}
            modelValue={modelValue.value}
            onUpdate:modelValue={props.onChange}
          >
            {props.options.map((option) => (
              <Checkbox
                key={option[valueName.value]}
                name={option[valueName.value]}
                disabled={disabled.value || option[disabledName.value]}
                {...option}
              >
                {option[labelName.value]}
              </Checkbox>
            ))}
          </CheckboxGroup>
        </div>
      )
    }
  },
})

/**
 * CheckboxRenderer - 使用 createRenderWrapper 工厂函数创建的复选框渲染器
 *
 * 通过 createRenderWrapper 包装 CheckboxRendererComponent，提供：
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
export { CheckboxRendererComponent }

// 默认导出原始组件以保持向后兼容性
export default CheckboxRendererComponent

// 导出包装后的渲染器（用于 RendererRegistry 注册）
export const CheckboxRendererWrapped = createRenderWrapper({
  component: CheckboxRendererComponent,
  defaultProps: {
    align: "right",
  },
})
