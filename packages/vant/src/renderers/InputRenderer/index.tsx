import {
  computed,
  defineComponent,
  nextTick,
  type PropType,
  reactive,
  ref,
  SetupContext,
  watch,
} from "vue"

import { Icon } from "vant"

import classNames from "classnames"

import "./index.scss"

/**
 * 格式化数字输入
 */
const formatNumber = (value: string, allowDot = true, allowMinus = true): string => {
  if (allowDot) {
    value = value.replace(/[^-0-9.]/g, "")
    // 只保留第一个小数点
    const dotIndex = value.indexOf(".")

    if (dotIndex !== -1) {
      value = value.slice(0, dotIndex + 1) + value.slice(dotIndex + 1).replace(/\./g, "")
    }
  } else {
    value = value.replace(/[^-0-9]/g, "")
  }

  if (allowMinus) {
    // 负号只能在开头
    const minusIndex = value.indexOf("-")

    if (minusIndex > 0) {
      value = value.replace(/-/g, "")
    } else if (minusIndex === 0) {
      value = "-" + value.slice(1).replace(/-/g, "")
    }
  } else {
    value = value.replace(/-/g, "")
  }

  return value
}

/**
 * 获取字符串长度（考虑 emoji 等特殊字符）
 */
const getStringLength = (str: string): number => {
  return [...String(str)].length
}

/**
 * 截取字符串
 */
const cutString = (str: string, maxLength: number): string => {
  return [...String(str)].slice(0, maxLength).join("")
}

export interface InputRendererProps {
  value?: string | number
  onChange?: (value: string) => void
  onBlur?: (event: FocusEvent) => void
  onFocus?: (event: FocusEvent) => void
  type?: "text" | "textarea" | "number" | "password" | "digit"
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  autofocus?: boolean
  maxlength?: number | string
  min?: number
  max?: number
  rows?: number | string
  autosize?: boolean | { minRows?: number; maxRows?: number }
  formatter?: (value: string) => string
  formatTrigger?: "onChange" | "onBlur"
  clearable?: boolean
  clearIcon?: string
  clearTrigger?: "focus" | "always"
  leftIcon?: string
  rightIcon?: string
  showWordLimit?: boolean
  autocomplete?: string
  autocapitalize?: string
  autocorrect?: string
  enterkeyhint?: "search" | "done" | "enter" | "go" | "next" | "previous" | "send"
  spellcheck?: boolean | null
  inputmode?: "text" | "search" | "tel" | "url" | "email" | "none" | "numeric" | "decimal"
  align?: "left" | "center" | "right"
  className?: string
  readonlyPlaceholder?: string
  formItemProps?: Record<string, any>
  error?: string[]
}

/**
 * 纯净的输入组件
 * 从 Vant Field 的 renderInput 逻辑中剥离出来
 * 只负责输入控件，不包含表单交互（label、rules、error 等由外层 Field 处理）
 *
 */
const InputRendererComponent = defineComponent({
  name: "InputRendererComponent",
  props: {
    value: {
      type: [String, Number] as PropType<InputRendererProps["value"]>,
      default: "",
    },
    onChange: {
      type: Function as PropType<InputRendererProps["onChange"]>,
      default: () => {},
    },
    onBlur: {
      type: Function as PropType<InputRendererProps["onBlur"]>,
      default: null,
    },
    onFocus: {
      type: Function as PropType<InputRendererProps["onFocus"]>,
      default: null,
    },
    type: {
      type: String as PropType<InputRendererProps["type"]>,
      default: "text",
    },
    placeholder: {
      type: String as PropType<InputRendererProps["placeholder"]>,
      default: "",
    },
    disabled: {
      type: Boolean as PropType<InputRendererProps["disabled"]>,
      default: false,
    },
    readonly: {
      type: Boolean as PropType<InputRendererProps["readonly"]>,
      default: false,
    },
    autofocus: {
      type: Boolean as PropType<InputRendererProps["autofocus"]>,
      default: false,
    },
    maxlength: {
      type: [Number, String] as PropType<InputRendererProps["maxlength"]>,
      default: undefined,
    },
    min: {
      type: Number as PropType<InputRendererProps["min"]>,
      default: undefined,
    },
    max: {
      type: Number as PropType<InputRendererProps["max"]>,
      default: undefined,
    },
    rows: {
      type: [Number, String] as PropType<InputRendererProps["rows"]>,
      default: undefined,
    },
    autosize: {
      type: [Boolean, Object] as PropType<InputRendererProps["autosize"]>,
      default: false,
    },
    formatter: {
      type: Function as PropType<InputRendererProps["formatter"]>,
      default: null,
    },
    formatTrigger: {
      type: String as PropType<InputRendererProps["formatTrigger"]>,
      default: "onChange",
    },
    clearable: {
      type: Boolean as PropType<InputRendererProps["clearable"]>,
      default: false,
    },
    clearIcon: {
      type: String as PropType<InputRendererProps["clearIcon"]>,
      default: "clear",
    },
    clearTrigger: {
      type: String as PropType<InputRendererProps["clearTrigger"]>,
      default: "focus",
    },
    leftIcon: {
      type: String as PropType<InputRendererProps["leftIcon"]>,
      default: "",
    },
    rightIcon: {
      type: String as PropType<InputRendererProps["rightIcon"]>,
      default: "",
    },
    showWordLimit: {
      type: Boolean as PropType<InputRendererProps["showWordLimit"]>,
      default: false,
    },
    autocomplete: {
      type: String as PropType<InputRendererProps["autocomplete"]>,
      default: undefined,
    },
    autocapitalize: {
      type: String as PropType<InputRendererProps["autocapitalize"]>,
      default: undefined,
    },
    autocorrect: {
      type: String as PropType<InputRendererProps["autocorrect"]>,
      default: undefined,
    },
    enterkeyhint: {
      type: String as PropType<InputRendererProps["enterkeyhint"]>,
      default: undefined,
    },
    spellcheck: {
      type: Boolean as PropType<InputRendererProps["spellcheck"]>,
      default: null,
    },
    inputmode: {
      type: String as PropType<InputRendererProps["inputmode"]>,
      default: undefined,
    },
    align: {
      type: String as PropType<InputRendererProps["align"]>,
      default: "left",
    },
    className: {
      type: String as PropType<InputRendererProps["className"]>,
      default: "",
    },
    readonlyPlaceholder: {
      type: String as PropType<InputRendererProps["readonlyPlaceholder"]>,
      default: "-",
    },
    formItemProps: {
      type: Object as PropType<InputRendererProps["formItemProps"]>,
      default: () => ({}),
    },
    error: {
      type: Array as PropType<InputRendererProps["error"]>,
      default: undefined,
    },
  },
  emits: [
    "update:value",
    "change",
    "blur",
    "focus",
    "clear",
    "keypress",
    "click-input",
    "click-left-icon",
    "click-right-icon",
  ],
  setup(props, { emit, expose, slots }: SetupContext) {
    const inputRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
    const clearIconRef = ref<typeof Icon | null>(null)
    const state = reactive({
      focused: false,
      composing: false,
    })

    // 获取当前值的字符串形式
    const getModelValue = (): string => String(props.value ?? "")

    // 计算 placeholder
    const computedPlaceholder = computed(() => {
      if (props.readonly) {
        return props.readonlyPlaceholder
      }

      return props.placeholder || ""
    })

    // 计算输入框类型（用于 input 元素的 type 属性）
    const inputType = computed(() => {
      const { type } = props

      if (type === "number" || type === "digit") {
        return "text"
      }

      if (type === "password") {
        return "password"
      }

      return "text"
    })

    // 计算 inputmode
    const computedInputmode = computed(
      ():
        | "text"
        | "search"
        | "tel"
        | "url"
        | "email"
        | "none"
        | "numeric"
        | "decimal"
        | undefined => {
        if (props.inputmode) return props.inputmode
        const { type } = props
        if (type === "number") return "decimal"
        if (type === "digit") return "numeric"

        return undefined
      }
    )

    // 是否显示清除按钮
    const showClear = computed(() => {
      if (props.clearable && !props.readonly) {
        const hasValue = getModelValue() !== ""
        const trigger =
          props.clearTrigger === "always" ||
          (props.clearTrigger === "focus" && state.focused)

        return hasValue && trigger
      }

      return false
    })

    // 限制值长度
    const limitValueLength = (value: string): string => {
      const { maxlength } = props

      if (maxlength !== undefined && getStringLength(value) > +maxlength) {
        const modelValue = getModelValue()

        if (modelValue && getStringLength(modelValue) === +maxlength) {
          return modelValue
        }

        const selectionEnd = inputRef.value?.selectionEnd

        if (state.focused && selectionEnd) {
          const valueArr = [...value]
          const exceededLength = valueArr.length - +maxlength
          valueArr.splice(selectionEnd - exceededLength, exceededLength)

          return valueArr.join("")
        }

        return cutString(value, +maxlength)
      }

      return value
    }

    // 更新值
    const updateValue = (
      value: string,
      trigger: "onChange" | "onBlur" = "onChange"
    ): void => {
      const originalValue = value
      value = limitValueLength(value)
      const limitDiffLen = originalValue.length - value.length

      // 数字类型格式化
      if (props.type === "number" || props.type === "digit") {
        const isNumber = props.type === "number"
        value = formatNumber(value, isNumber, isNumber)

        // blur 时处理 min/max
        if (trigger === "onBlur" && value !== "") {
          const { min, max } = props

          if (min !== undefined || max !== undefined) {
            const numValue = parseFloat(value)

            if (!isNaN(numValue)) {
              const clampedValue = Math.min(
                Math.max(numValue, min ?? -Infinity),
                max ?? Infinity
              )

              if (numValue !== clampedValue) {
                value = String(clampedValue)
              }
            }
          }
        }
      }

      // 自定义格式化
      let formatterDiffLen = 0

      if (props.formatter !== null && trigger === props.formatTrigger) {
        const { formatter, maxlength } = props
        value = formatter(value)

        if (maxlength !== undefined && getStringLength(value) > +maxlength) {
          value = cutString(value, +maxlength)
        }

        if (inputRef.value && state.focused) {
          const { selectionEnd } = inputRef.value
          if (selectionEnd !== null) {
            const bcoVal = cutString(originalValue, selectionEnd)
            formatterDiffLen = formatter(bcoVal).length - bcoVal.length
          }
        }
      }

      // 同步 input 元素的值和光标位置
      if (inputRef.value && inputRef.value.value !== value) {
        if (state.focused) {
          let { selectionStart, selectionEnd } = inputRef.value
          inputRef.value.value = value

          if (selectionStart !== null && selectionEnd !== null) {
            const valueLen = value.length

            if (limitDiffLen) {
              selectionStart -= limitDiffLen
              selectionEnd -= limitDiffLen
            } else if (formatterDiffLen) {
              selectionStart += formatterDiffLen
              selectionEnd += formatterDiffLen
            }

            inputRef.value.setSelectionRange(
              Math.min(selectionStart, valueLen),
              Math.min(selectionEnd, valueLen)
            )
          }
        } else {
          inputRef.value.value = value
        }
      }

      // 触发值变化
      if (value !== String(props.value ?? "")) {
        props.onChange?.(value)
        emit("update:value", value)
      }
    }

    // 输入事件
    const handleInput = (event: Event): void => {
      if (!state.composing) {
        updateValue((event.target as HTMLInputElement).value)
      }
    }

    // 聚焦事件
    const handleFocus = (event: FocusEvent): void => {
      state.focused = true
      props.onFocus?.(event)
      emit("focus", event)
      nextTick(adjustTextareaSize)
    }

    // 失焦事件
    const handleBlur = (event: FocusEvent): void => {
      state.focused = false
      updateValue(getModelValue(), "onBlur")
      props.onBlur?.(event)
      emit("blur", event)
    }

    // 键盘事件
    const handleKeypress = (event: KeyboardEvent): void => {
      const ENTER_CODE = 13

      if (event.keyCode === ENTER_CODE) {
        if (props.type !== "textarea") {
          event.preventDefault()
        }
      }

      emit("keypress", event)
    }

    // 输入法组合开始
    const handleCompositionStart = (): void => {
      state.composing = true
    }

    // 输入法组合结束
    const handleCompositionEnd = (event: CompositionEvent): void => {
      state.composing = false
      updateValue((event.target as HTMLInputElement).value)
    }

    // 点击输入框
    const handleClickInput = (event: MouseEvent): void => {
      emit("click-input", event)
    }

    // 点击左侧图标
    const handleClickLeftIcon = (event: MouseEvent | KeyboardEvent): void => {
      emit("click-left-icon", event)
    }

    // 点击右侧图标
    const handleClickRightIcon = (event: MouseEvent | KeyboardEvent): void => {
      emit("click-right-icon", event)
    }

    // 清除按钮点击
    const handleClear = (event: TouchEvent | MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      props.onChange?.("")
      emit("update:value", "")
      emit("clear", event)
      nextTick(() => {
        inputRef.value?.focus()
      })
    }

    // 调整 textarea 高度
    const adjustTextareaSize = (): void => {
      const input = inputRef.value

      if (props.type === "textarea" && props.autosize && input) {
        const { autosize } = props
        const minRows = typeof autosize === "object" ? autosize.minRows : undefined
        const maxRows = typeof autosize === "object" ? autosize.maxRows : undefined

        input.style.height = "auto"

        const style = window.getComputedStyle(input)
        const lineHeight = parseFloat(style.lineHeight) || 20
        const paddingTop = parseFloat(style.paddingTop) || 0
        const paddingBottom = parseFloat(style.paddingBottom) || 0
        const borderTop = parseFloat(style.borderTopWidth) || 0
        const borderBottom = parseFloat(style.borderBottomWidth) || 0

        const minHeight = minRows
          ? lineHeight * minRows + paddingTop + paddingBottom + borderTop + borderBottom
          : undefined
        const maxHeight = maxRows
          ? lineHeight * maxRows + paddingTop + paddingBottom + borderTop + borderBottom
          : undefined

        let height = input.scrollHeight

        if (minHeight !== undefined) {
          height = Math.max(height, minHeight)
        }

        if (maxHeight !== undefined) {
          height = Math.min(height, maxHeight)
        }

        input.style.height = `${height}px`
      }
    }

    // 暴露方法
    const focus = (): void => inputRef.value?.focus()
    const blur = (): void => inputRef.value?.blur()

    expose({
      focus,
      blur,
      get inputRef() {
        return inputRef.value
      },
    })

    // 监听值变化（仅同步 DOM 和调整 textarea 尺寸，不触发 onChange）
    watch(
      () => props.value,
      (newVal, oldVal) => {
        if (String(newVal ?? "") !== String(oldVal ?? "")) {
          // 仅同步 input 元素的值，不走 updateValue 以避免循环触发 onChange
          if (inputRef.value && inputRef.value.value !== String(newVal ?? "")) {
            inputRef.value.value = String(newVal ?? "")
          }

          nextTick(adjustTextareaSize)
        }
      }
    )

    // 渲染左侧图标
    const renderLeftIcon = () => {
      const leftIconSlot = slots["left-icon"]

      if (props.leftIcon || leftIconSlot) {
        return (
          <div
            class="schema-input__left-icon"
            onClick={handleClickLeftIcon}
            onKeydown={(e: KeyboardEvent) => e.key === "Enter" && handleClickLeftIcon(e)}
            role="button"
            tabindex={0}
          >
            {leftIconSlot ? leftIconSlot() : <Icon name={props.leftIcon} />}
          </div>
        )
      }

      return null
    }

    // 渲染右侧图标
    const renderRightIcon = () => {
      const rightIconSlot = slots["right-icon"]

      if (props.rightIcon || rightIconSlot) {
        return (
          <div
            class="schema-input__right-icon"
            onClick={handleClickRightIcon}
            onKeydown={(e: KeyboardEvent) => e.key === "Enter" && handleClickRightIcon(e)}
            role="button"
            tabindex={0}
          >
            {rightIconSlot ? rightIconSlot() : <Icon name={props.rightIcon} />}
          </div>
        )
      }

      return null
    }

    // 渲染清除按钮
    const renderClear = () => {
      if (showClear.value) {
        return (
          <Icon
            ref={clearIconRef}
            name={props.clearIcon}
            class="schema-input__clear"
            // @ts-ignore - Vant Icon supports these events
            onTouchstart={handleClear}
            onMousedown={handleClear}
          />
        )
      }

      return null
    }

    // 渲染字数统计
    const renderWordLimit = () => {
      if (props.showWordLimit && props.maxlength) {
        const count = getStringLength(getModelValue())

        return (
          <div class="schema-input__word-limit">
            <span class="schema-input__word-num">{count}</span>/{props.maxlength}
          </div>
        )
      }

      return null
    }

    // 渲染按钮插槽
    const renderButton = () => {
      if (slots.button) {
        return <div class="schema-input__button">{slots.button()}</div>
      }

      return null
    }

    // 渲染输入框
    const renderInput = () => {
      const baseClass = classNames(
        "schema-input__control",
        `schema-input__control--${props.align}`,
        {
          "schema-input__control--disabled": props.disabled,
          "schema-input__control--readonly": props.readonly,
          "schema-input__control--min-height":
            props.type === "textarea" && !props.autosize,
        }
      )

      const commonAttrs = {
        ref: inputRef,
        class: baseClass,
        value: getModelValue(),
        disabled: props.disabled,
        readonly: props.readonly,
        autofocus: props.autofocus,
        placeholder: computedPlaceholder.value,
        autocomplete: props.autocomplete,
        autocapitalize: props.autocapitalize,
        autocorrect: props.autocorrect,
        enterkeyhint: props.enterkeyhint,
        spellcheck: props.spellcheck ?? undefined,
        inputmode: computedInputmode.value,
        onInput: handleInput,
        onFocus: handleFocus,
        onBlur: handleBlur,
        onKeypress: handleKeypress,
        onClick: handleClickInput,
        onCompositionstart: handleCompositionStart,
        onCompositionend: handleCompositionEnd,
      }

      if (props.type === "textarea") {
        return (
          <textarea
            {...commonAttrs}
            rows={props.rows !== undefined ? +props.rows : undefined}
          />
        )
      }

      return <input {...commonAttrs} type={inputType.value} />
    }

    return () => (
      <div class={classNames("schema-input", props.className)}>
        {renderLeftIcon()}
        <div class="schema-input__body">
          {renderInput()}
          {renderClear()}
          {renderRightIcon()}
          {renderButton()}
        </div>
        {renderWordLimit()}
        {slots.extra?.()}
      </div>
    )
  },
})

export default InputRendererComponent
