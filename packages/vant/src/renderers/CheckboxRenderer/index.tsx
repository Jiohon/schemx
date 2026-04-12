import { computed, defineComponent, PropType, SetupContext } from "vue"

import { Checkbox, CheckboxGroup } from "vant"

import { WithRemoteOptions } from "@schemx/vue"
import classNames from "classnames"

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

    const disabled = computed(() => props?.disabled || props.formItemProps?.disabled)
    const readonly = computed(() => props?.readonly || props.formItemProps?.readonly)

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
            class={classNames("schemx-checkbox-renderer", props.className)}
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
            "schemx-renderer",
            "schemx-checkbox-renderer",
            props.className,
            {
              "schemx-renderer-disabled": disabled.value,
              "schemx-renderer-readonly": readonly.value,
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

export default WithRemoteOptions(CheckboxRendererComponent)
