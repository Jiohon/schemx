import { computed, defineComponent, PropType, ref, SetupContext } from "vue"

import { Icon } from "vant"

import classNames from "classnames"

import InputRenderer from "../InputRenderer"
import "./index.scss"

export interface TextRendererProps {
  className?: string
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
  clearable?: boolean
  clearIcon?: string
  clearTrigger?: "focus" | "always"
  leftIcon?: string
  rightIcon?: string
  showWordLimit?: boolean
  maxlength?: number | string
  error?: string[]
}

/**
 * 文本输入渲染器组件
 * 基于 InputRenderer 实现
 *
 */
const TextRendererComponent = defineComponent({
  name: "TextRendererComponent",
  props: {
    className: {
      type: String,
      default: "",
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
    clearable: {
      type: Boolean,
      default: false,
    },
    clearIcon: {
      type: String,
      default: "clear",
    },
    clearTrigger: {
      type: String as PropType<"focus" | "always">,
      default: "focus",
    },
    leftIcon: {
      type: String,
      default: "",
    },
    rightIcon: {
      type: String,
      default: "",
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
    // 密码可见性切换
    const passwordVisible = ref(false)

    const readonly = computed(() => props.readonly || props.formItemProps?.readonly)
    const disabled = computed(() => props.disabled || props.formItemProps?.disabled)

    // 判断是否为密码模式
    const isPasswordMode = computed(
      () => (attrs as Record<string, any>).type === "password"
    )

    // 计算实际的输入类型
    const inputType = computed(() => {
      if (isPasswordMode.value) {
        return passwordVisible.value ? "text" : "password"
      }

      return (attrs as Record<string, any>).type || "text"
    })

    // 密码可见性图标
    const passwordIcon = computed(() => {
      return passwordVisible.value ? "eye-o" : "closed-eye"
    })

    // 切换密码可见性
    const handleTogglePassword = (): void => {
      passwordVisible.value = !passwordVisible.value
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
          "schema-form-text-renderer",
          props.className,
          {
            "schema-form-renderer-readonly": readonly.value,
            "schema-form-renderer-disabled": disabled.value,
          }
        )}
      >
        <InputRenderer
          ref={inputRef}
          type={inputType.value}
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
          maxlength={(attrs as Record<string, any>).maxlength}
          min={(attrs as Record<string, any>).min}
          max={(attrs as Record<string, any>).max}
          formatter={(attrs as Record<string, any>).formatter}
          formatTrigger={(attrs as Record<string, any>).formatTrigger}
          autocomplete={(attrs as Record<string, any>).autocomplete}
          autofocus={(attrs as Record<string, any>).autofocus}
          clearable={props.clearable}
          clearIcon={props.clearIcon}
          clearTrigger={props.clearTrigger}
          leftIcon={props.leftIcon}
          rightIcon={isPasswordMode.value ? "" : props.rightIcon}
          showWordLimit={props.showWordLimit && !readonly.value && !disabled.value}
          v-slots={{
            "left-icon": slots["left-icon"],
            "right-icon": isPasswordMode.value
              ? () => (
                  <Icon
                    name={passwordIcon.value}
                    class="schema-form-text-renderer__password-icon"
                    onClick={handleTogglePassword}
                  />
                )
              : slots["right-icon"],
            button: slots.button,
            extra: slots.extra,
          }}
        />
      </div>
    )
  },
})

export { TextRendererComponent }

export default TextRendererComponent
