import { computed, defineComponent, PropType, SetupContext } from "vue"

import { useDictOptions } from "@schemx/vue"
import classNames from "classnames"

import { getFieldProps } from "@/utils"

import Selector from "./Selector"
import "./index.scss"

export interface SelectorOption {
  label?: string
  value?: string | number
  disabled?: boolean
  [key: string]: any
}

export interface SelectorRendererProps {
  value?: string | number
  onChange?: (value: string | number) => void
  options?: SelectorOption[]
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
 * 选择组渲染器组件
 *
 */
const SelectorRendererComponent = defineComponent({
  name: "SelectorRendererComponent",
  props: {
    value: {
      type: [String, Number] as PropType<string | number>,
      default: undefined,
    },
    onChange: {
      type: Function as PropType<(value: string | number) => void>,
      default: () => {},
    },
    options: {
      type: Array as PropType<SelectorOption[]>,
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
    const { remoteOptions } = useDictOptions(attrs as Record<string, any>)

    const labelName = computed(() => props.fieldNames?.label || "label")
    const valueName = computed(() => props.fieldNames?.value || "value")

    const disabled = computed(() => props.disabled || props.formItemProps?.disabled)
    const readonly = computed(() => props.readonly || props.formItemProps?.readonly)

    /**
     * 数据源
     */
    const schemas = computed(() => {
      if (Array.isArray(remoteOptions.value) && remoteOptions.value?.length > 0) {
        return remoteOptions.value
      }

      if (Array.isArray(props.options) && props.options?.length > 0) {
        return props.options
      }

      return (attrs as Record<string, any>)?.schemas || []
    })

    const fieldValue = computed(() => {
      return getOption(props.value, labelName.value)
    })

    const getOption = (v: any, key: string): any => {
      const option = schemas.value.find(
        (option: SelectorOption) => option[valueName.value] === v
      )

      return option ? option[key] : v
    }

    return () => {
      if (readonly.value) {
        return (
          <div
            class={classNames("schemx-selector-renderer", props.className)}
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
            "schemx-selector-renderer",
            props.className,
            {
              "schemx-renderer-readonly": readonly.value,
              "schemx-renderer-disabled": disabled.value,
            }
          )}
        >
          <Selector
            {...attrs}
            options={schemas.value}
            fieldNames={props.fieldNames}
            disabled={disabled.value}
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
          />
        </div>
      )
    }
  },
})

export default SelectorRendererComponent
