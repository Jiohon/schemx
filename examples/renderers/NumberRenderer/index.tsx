import { computed, defineComponent, PropType, ref, SetupContext } from "vue"

import classNames from "classnames"

import InputRenderer from "../InputRenderer"
import "./index.scss"

export interface NumberRendererProps {
  className?: string
  type?: "number" | "digit"
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  placeholder?: string
  readonlyPlaceholder?: string
  readonly?: boolean
  disabled?: boolean
  value?: number | null
  onChange?: (value: number | null) => void
  onBlur?: (event: FocusEvent) => void
  onFocus?: (event: FocusEvent) => void
  align?: "left" | "center" | "right"
  clearable?: boolean
  min?: number
  max?: number
  error?: string[]
}

/**
 * 数字输入渲染器组件
 * 支持 number、digit 类型
 * 基于 InputRenderer 实现
 *
 */
const NumberRendererComponent = defineComponent({
  name: "NumberRendererComponent",
  props: {
    className: {
      type: String,
      default: "",
    },
    type: {
      type: String as PropType<"number" | "digit">,
      default: "number",
    },
    formItemProps: {
      type: Object as PropType<Record<string, any>>,
      default: () => ({}),
    },
    formInstance: {
      type: Object as PropType<Record<string, any> | null>,
      default: null,
    },
    placeholder: {
      type: String,
      default: undefined,
    },
    readonlyPlaceholder: {
      type: String,
      default: "-",
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    value: {
      type: [Number, null] as PropType<number | null>,
      default: null,
    },
    onChange: {
      type: Function as PropType<(value: number | null) => void>,
      default: () => {},
    },
    onBlur: {
      type: Function as PropType<(event: FocusEvent) => void>,
      default: null,
    },
    onFocus: {
      type: Function as PropType<(event: FocusEvent) => void>,
      default: null,
    },
    align: {
      type: String as PropType<"left" | "center" | "right">,
      default: "right",
    },
    clearable: {
      type: Boolean,
      default: false,
    },
    min: {
      type: Number,
      default: undefined,
    },
    max: {
      type: Number,
      default: undefined,
    },
    error: {
      type: Array as PropType<string[]>,
      default: undefined,
    },
  },
  setup(props, { attrs, slots, expose }: SetupContext) {
    const inputRef = ref<InstanceType<typeof InputRenderer> | null>(null)

    const readonly = computed(() => props.readonly || props.formItemProps?.readonly)
    const disabled = computed(() => props.disabled || props.formItemProps?.disabled)

    // 处理值变化，将字符串转换为 number | null
    const handleChange = (value: string): void => {
      if (value === "" || value === null || value === undefined) {
        props.onChange?.(null)

        return
      }

      const num = Number(value)
      props.onChange?.(Number.isNaN(num) ? null : num)
    }

    // 暴露方法
    expose({
      focus: () => (inputRef.value as any)?.focus?.(),
      blur: () => (inputRef.value as any)?.blur?.(),
    })

    return () => (
      <div
        class={classNames(
          "schema-form-renderer",
          "schema-form-number-renderer",
          props.className,
          {
            "schema-form-renderer-readonly": readonly.value,
            "schema-form-renderer-disabled": disabled.value,
          }
        )}
      >
        <InputRenderer
          ref={inputRef}
          type={props.type}
          value={props.value != null ? String(props.value) : ""}
          onChange={handleChange}
          onBlur={props.onBlur}
          onFocus={props.onFocus}
          placeholder={props.placeholder}
          readonlyPlaceholder={props.readonlyPlaceholder}
          readonly={readonly.value}
          disabled={disabled.value}
          align={props.align}
          formItemProps={props.formItemProps}
          min={props.min ?? (attrs as Record<string, any>).min}
          max={props.max ?? (attrs as Record<string, any>).max}
          maxlength={(attrs as Record<string, any>).maxlength}
          clearable={props.clearable}
          v-slots={{
            "left-icon": slots["left-icon"],
            "right-icon": slots["right-icon"],
            button: slots.button,
            extra: slots.extra,
          }}
        />
      </div>
    )
  },
})

export { NumberRendererComponent }

export default NumberRendererComponent
