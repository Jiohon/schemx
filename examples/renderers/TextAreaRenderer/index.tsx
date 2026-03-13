import { computed, defineComponent, PropType, ref, SetupContext } from "vue"

import classNames from "classnames"

import InputRenderer from "../InputRenderer"
import "./index.scss"

export interface TextAreaRendererProps {
  className?: string
  autosize?: boolean | { minRows?: number; maxRows?: number }
  autoSize?: boolean | { minRows?: number; maxRows?: number }
  rows?: number | string
  maxlength?: number | string
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  placeholder?: string
  readonlyPlaceholder?: string
  readonly?: boolean
  disabled?: boolean
  value?: string | number
  onChange?: (value: string) => void
  onBlur?: (event: FocusEvent) => void
  onFocus?: (event: FocusEvent) => void
  align?: "left" | "center" | "right"
  showWordLimit?: boolean
  error?: string[]
}

/**
 * 文本域输入渲染器组件
 * 基于 InputRenderer 实现
 *
 */
const TextAreaRendererComponent = defineComponent({
  name: "TextAreaRendererComponent",
  props: {
    className: {
      type: String,
      default: "",
    },
    autosize: {
      type: [Boolean, Object] as PropType<
        boolean | { minRows?: number; maxRows?: number }
      >,
      default: () => ({ minRows: 2, maxRows: 6 }),
    },
    // 兼容旧的 autoSize 属性名
    autoSize: {
      type: [Boolean, Object] as PropType<
        boolean | { minRows?: number; maxRows?: number }
      >,
      default: undefined,
    },
    rows: {
      type: [Number, String] as PropType<number | string>,
      default: undefined,
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
      type: [String, Number] as PropType<string | number>,
      default: "",
    },
    onChange: {
      type: Function as PropType<(value: string) => void>,
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
    showWordLimit: {
      type: Boolean,
      default: false,
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

    // 兼容 autoSize 和 autosize
    const computedAutosize = computed(() => {
      return props.autoSize ?? props.autosize ?? { minRows: 2, maxRows: 6 }
    })

    // 计算行数
    const computedRows = computed(() => {
      if (props.rows !== undefined) {
        return props.rows
      }

      const autosize = computedAutosize.value

      if (typeof autosize === "object" && autosize.minRows) {
        return autosize.minRows
      }

      return 2
    })

    // 暴露方法
    expose({
      focus: () => (inputRef.value as any)?.focus?.(),
      blur: () => (inputRef.value as any)?.blur?.(),
    })

    return () => (
      <div
        class={classNames(
          "schema-form-renderer",
          "schema-form-textarea-renderer",
          props.className,
          {
            "schema-form-renderer-readonly": readonly.value,
            "schema-form-renderer-disabled": disabled.value,
          }
        )}
      >
        <InputRenderer
          ref={inputRef}
          type="textarea"
          value={props.value}
          onChange={props.onChange}
          onBlur={props.onBlur}
          onFocus={props.onFocus}
          placeholder={props.placeholder}
          readonlyPlaceholder={props.readonlyPlaceholder}
          readonly={readonly.value}
          disabled={disabled.value}
          align={props.align}
          formItemProps={props.formItemProps}
          rows={computedRows.value}
          autosize={computedAutosize.value}
          maxlength={(attrs as Record<string, any>).maxlength}
          showWordLimit={props.showWordLimit && !readonly.value && !disabled.value}
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

export { TextAreaRendererComponent }

export default TextAreaRendererComponent
