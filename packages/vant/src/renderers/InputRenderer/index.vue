<template>
  <div :class="classNames('schemx-input', props.className)" @click="handleClickRoot">
    <!-- 左侧图标 -->
    <div
      v-if="props.leftIcon || slots['left-icon']"
      class="schemx-input__left-icon"
      role="button"
      tabindex="0"
      @click="handleClickLeftIcon"
      @keydown.enter="handleClickLeftIcon"
    >
      <slot v-if="slots['left-icon']" name="left-icon" />
      <Icon v-else :name="props.leftIcon" />
    </div>

    <!-- 主体 -->
    <div class="schemx-input__body">
      <!-- 输入框/文本域 -->
      <textarea
        v-if="props.type === 'textarea'"
        ref="inputRef"
        :class="inputControlClass"
        :value="modelValue"
        :disabled="props.disabled"
        :readonly="props.readonly"
        :autofocus="props.autofocus"
        :placeholder="computedPlaceholder"
        :autocomplete="props.autocomplete"
        :autocapitalize="props.autocapitalize"
        :autocorrect="props.autocorrect"
        :enterkeyhint="props.enterkeyhint"
        :spellcheck="props.spellcheck ?? undefined"
        :inputmode="computedInputmode"
        :rows="props.rows !== undefined ? +props.rows : undefined"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keypress="handleKeypress"
        @click="handleClickInput"
        @compositionstart="handleCompositionStart"
        @compositionend="handleCompositionEnd"
      />
      <input
        v-else
        ref="inputRef"
        :type="inputType"
        :class="inputControlClass"
        :value="modelValue"
        :disabled="props.disabled"
        :readonly="props.readonly"
        :autofocus="props.autofocus"
        :placeholder="computedPlaceholder"
        :autocomplete="props.autocomplete"
        :autocapitalize="props.autocapitalize"
        :autocorrect="props.autocorrect"
        :enterkeyhint="props.enterkeyhint"
        :spellcheck="props.spellcheck ?? undefined"
        :inputmode="computedInputmode"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keypress="handleKeypress"
        @click="handleClickInput"
        @compositionstart="handleCompositionStart"
        @compositionend="handleCompositionEnd"
      />

      <!-- 清除按钮 -->
      <Icon
        v-if="showClear"
        ref="clearIconRef"
        :name="props.clearIcon"
        class="schemx-input__clear"
        @touchstart.passive="handleClear"
        @mousedown="handleClear"
      />

      <!-- 右侧图标 -->
      <div
        v-if="props.rightIcon || slots['right-icon']"
        class="schemx-input__right-icon"
        role="button"
        tabindex="0"
        @click="handleClickRightIcon"
        @keydown.enter="handleClickRightIcon"
      >
        <slot v-if="slots['right-icon']" name="right-icon" />
        <Icon v-else :name="props.rightIcon" />
      </div>

      <!-- 按钮插槽 -->
      <div v-if="slots.button" class="schemx-input__button">
        <slot name="button" />
      </div>
    </div>

    <!-- 字数统计 -->
    <div v-if="props.showWordLimit && props.maxlength" class="schemx-input__word-limit">
      <span class="schemx-input__word-num"> {{ wordCount }} </span>/{{ props.maxlength }}
    </div>

    <!-- 额外插槽 -->
    <slot v-if="slots.extra" name="extra" />
  </div>
</template>

<script setup lang="ts">
  /**
   * 纯净的输入组件
   *
   * 从 Vant Field 的 renderInput 逻辑中剥离出来，
   * 只负责输入控件，不包含表单交互（label、rules 等由外层 Field 处理）。
   *
   * @module renderers/InputRenderer
   */
  import { computed, nextTick, reactive, ref, useSlots, watch } from "vue"

  import { Icon } from "vant"

  import classNames from "classnames"

  import { cutString, formatNumber, getStringLength } from "./types"

  import type { InputRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "InputRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<InputRendererProps>(), {
    value: "",
    onChange: undefined,
    onBlur: undefined,
    onFocus: undefined,
    type: "text",
    placeholder: "",
    disabled: false,
    readonly: false,
    autofocus: false,
    maxlength: undefined,
    min: undefined,
    max: undefined,
    rows: undefined,
    autosize: false,
    formatter: undefined,
    formatTrigger: "onChange",
    clearable: false,
    clearIcon: "clear",
    clearTrigger: "focus",
    leftIcon: "",
    rightIcon: "",
    showWordLimit: false,
    autocomplete: undefined,
    autocapitalize: undefined,
    autocorrect: undefined,
    enterkeyhint: undefined,
    spellcheck: null,
    inputmode: undefined,
    align: "left",
    className: "",
    readonlyPlaceholder: "-",
  })

  const emit = defineEmits<{
    "update:value": [value: string]
    change: [value: string]
    blur: [event: FocusEvent]
    focus: [event: FocusEvent]
    clear: [event: TouchEvent | MouseEvent]
    keypress: [event: KeyboardEvent]
    "click-input": [event: MouseEvent]
    "click-left-icon": [event: MouseEvent | KeyboardEvent]
    "click-right-icon": [event: MouseEvent | KeyboardEvent]
  }>()

  const slots = useSlots()

  const inputRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const clearIconRef = ref<typeof Icon | null>(null)

  const state = reactive({
    focused: false,
    composing: false,
  })

  /** 获取当前值的字符串形式 */
  const modelValue = computed(() => String(props.value ?? ""))

  /** 计算 placeholder */
  const computedPlaceholder = computed(() => {
    if (props.readonly) {
      return props.readonlyPlaceholder
    }

    return props.placeholder || ""
  })

  /** 计算输入框类型（用于 input 元素的 type 属性） */
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

  /** 计算 inputmode */
  const computedInputmode = computed(() => {
    if (props.inputmode) return props.inputmode
    const { type } = props
    if (type === "number") return "decimal"
    if (type === "digit") return "numeric"

    return undefined
  })

  /** 是否显示清除按钮 */
  const showClear = computed(() => {
    if (props.clearable && !props.readonly) {
      const hasValue = modelValue.value !== ""
      const trigger =
        props.clearTrigger === "always" ||
        (props.clearTrigger === "focus" && state.focused)

      return hasValue && trigger
    }

    return false
  })

  /** 字数统计 */
  const wordCount = computed(() => getStringLength(modelValue.value))

  /** 输入框控制类名 */
  const inputControlClass = computed(() =>
    classNames("schemx-input__control", `schemx-input__control--${props.align}`, {
      "schemx-input__control--disabled": props.disabled,
      "schemx-input__control--readonly": props.readonly,
      "schemx-input__control--min-height": props.type === "textarea" && !props.autosize,
    })
  )

  /** 限制值长度 */
  const limitValueLength = (value: string): string => {
    const { maxlength } = props

    if (maxlength !== undefined && getStringLength(value) > +maxlength) {
      const currentModelValue = modelValue.value

      if (currentModelValue && getStringLength(currentModelValue) === +maxlength) {
        return currentModelValue
      }

      const selectionEnd = inputRef.value?.selectionEnd

      if (state.focused && selectionEnd != null && selectionEnd >= 0) {
        const valueArr = [...value]
        const exceededLength = valueArr.length - +maxlength
        valueArr.splice(selectionEnd - exceededLength, exceededLength)

        return valueArr.join("")
      }

      return cutString(value, +maxlength)
    }

    return value
  }

  /** 更新值 */
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

    if (props.formatter && trigger === props.formatTrigger) {
      const { maxlength } = props
      value = props.formatter(value)

      if (maxlength !== undefined && getStringLength(value) > +maxlength) {
        value = cutString(value, +maxlength)
      }

      if (inputRef.value && state.focused) {
        const { selectionEnd } = inputRef.value
        if (selectionEnd !== null) {
          const bcoVal = cutString(originalValue, selectionEnd)
          formatterDiffLen = props.formatter(bcoVal).length - bcoVal.length
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

  /** 输入事件 */
  const handleInput = (event: Event): void => {
    if (!state.composing) {
      updateValue((event.target as HTMLInputElement).value)
    }
  }

  /** 聚焦事件 */
  const handleFocus = (event: FocusEvent): void => {
    state.focused = true
    props.onFocus?.(event)
    emit("focus", event)
    nextTick(adjustTextareaSize)
  }

  /** 失焦事件 */
  const handleBlur = (event: FocusEvent): void => {
    state.focused = false
    updateValue(modelValue.value, "onBlur")
    props.onBlur?.(event)
    emit("blur", event)
  }

  /** 键盘事件 */
  const handleKeypress = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      if (props.type !== "textarea") {
        event.preventDefault()
      }
    }

    emit("keypress", event)
  }

  /** 输入法组合开始 */
  const handleCompositionStart = (): void => {
    state.composing = true
  }

  /** 输入法组合结束 */
  const handleCompositionEnd = (event: CompositionEvent): void => {
    state.composing = false
    updateValue((event.target as HTMLInputElement).value)
  }

  /** 点击输入框 */
  const handleClickInput = (event: MouseEvent): void => {
    emit("click-input", event)
  }

  /** 点击非交互展示区域时聚焦输入框 */
  const handleClickRoot = (event: MouseEvent): void => {
    if (props.disabled) return

    const target = event.target

    if (!(target instanceof Element)) return

    const interactiveSelector = [
      "input",
      "textarea",
      "button",
      "a",
      "select",
      "option",
      "label",
      "[role='button']",
      "[tabindex]",
      "[contenteditable='true']",
      ".schemx-input__clear",
      ".schemx-input__button",
    ].join(",")

    if (target.closest(interactiveSelector)) return

    inputRef.value?.focus()
  }

  /** 点击左侧图标 */
  const handleClickLeftIcon = (event: MouseEvent | KeyboardEvent): void => {
    emit("click-left-icon", event)
  }

  /** 点击右侧图标 */
  const handleClickRightIcon = (event: MouseEvent | KeyboardEvent): void => {
    emit("click-right-icon", event)
  }

  /** 清除按钮点击 */
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

  /** 调整 textarea 高度 */
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

  /** 聚焦方法 */
  const focus = (): void => inputRef.value?.focus()

  /** 失焦方法 */
  const blur = (): void => inputRef.value?.blur()

  defineExpose({
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
</script>
