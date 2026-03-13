import { computed, defineComponent, PropType, ref, SetupContext } from "vue"

import { Switch } from "vant"

import classNames from "classnames"

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

export default SwitchRendererComponent
