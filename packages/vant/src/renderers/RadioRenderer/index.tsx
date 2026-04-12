import { computed, defineComponent, PropType, SetupContext } from "vue"

import { Radio, RadioGroup } from "vant"

import { WithRemoteOptions } from "@schemx/vue"
import classNames from "classnames"

import { getFieldProps } from "@/utils"
import "./index.scss"

export interface RadioOption {
  label?: string
  value?: string | number | boolean
  disabled?: boolean
  [key: string]: any
}

export interface RadioRendererProps {
  value?: string | number | boolean
  onChange?: (value: string | number | boolean) => void
  options?: RadioOption[]
  className?: string
  fieldNames?: {
    label?: string
    value?: string
    disabled?: string
  }
  readonly?: boolean
  readonlyPlaceholder?: string
  disabled?: boolean
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  error?: string[]
}

/**
 * 单选框渲染器组件
 * 完整继承 vant Radio 组件的所有功能
 *
 */
const RadioRendererComponent = defineComponent({
  name: "RadioRendererComponent",
  props: {
    value: {
      type: [String, Number, Boolean] as PropType<string | number | boolean>,
      default: undefined,
    },
    onChange: {
      type: Function as PropType<(value: string | number | boolean) => void>,
      default: () => {},
    },
    options: {
      type: Array as PropType<RadioOption[]>,
      default: () => [],
    },
    className: {
      type: String,
      default: "",
    },
    fieldNames: {
      type: Object as PropType<{ label?: string; value?: string; disabled?: string }>,
      default: () => ({}),
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

    // const disabled = computed(() => props.disabled || props.formItemProps?.disabled)
    // const readonly = computed(() => props.readonly || props.formItemProps?.readonly)

    const fieldValue = computed(() => {
      return getOption(props.value, labelName.value)
    })

    const getOption = (v: any, key: string): any => {
      const option = props.options.find((option) => option[valueName.value] === v)

      return option ? option[key] : v
    }

    return () => {
      if (props.readonly) {
        return (
          <div
            class={classNames("schemx-radio-renderer", props.className)}
            style={{
              textAlign: getFieldProps(attrs as Record<string, any>, "align", "right"),
            }}
          >
            {props.readonly ? props.readonlyPlaceholder : fieldValue.value}
          </div>
        )
      }

      return (
        <div
          class={classNames("schemx-renderer", "schemx-radio-renderer", props.className, {
            "schemx-renderer-readonly": props.readonly,
            "schemx-renderer-disabled": props.disabled,
          })}
        >
          <RadioGroup
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
            modelValue={props.value}
            onUpdate:modelValue={props.onChange}
          >
            {props.options.map((option) => (
              <Radio
                key={option[valueName.value]}
                name={option[valueName.value]}
                disabled={props.disabled || option[disabledName.value]}
                {...option}
              >
                {option[labelName.value]}
              </Radio>
            ))}
          </RadioGroup>
        </div>
      )
    }
  },
})

export default WithRemoteOptions(RadioRendererComponent)
