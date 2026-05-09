<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-textarea-renderer', props.className, {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      })
    "
  >
    <InputRenderer
      ref="inputRef"
      type="textarea"
      :value="props.value"
      :placeholder="props.placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="readonly"
      :disabled="disabled"
      :align="props.align"
      :form-item-props="props.formItemProps"
      :rows="computedRows"
      :autosize="computedAutosize"
      :maxlength="attrs.maxlength"
      :show-word-limit="props.showWordLimit && !readonly && !disabled"
      @change="props.onChange"
      @blur="props.onBlur"
      @focus="props.onFocus"
    >
      <template v-if="slots['left-icon']" #left-icon>
        <slot name="left-icon" />
      </template>
      <template v-if="slots['right-icon']" #right-icon>
        <slot name="right-icon" />
      </template>
      <template v-if="slots.button" #button>
        <slot name="button" />
      </template>
      <template v-if="slots.extra" #extra>
        <slot name="extra" />
      </template>
    </InputRenderer>
  </div>
</template>

<script setup lang="ts">
  /**
   * 文本域输入渲染器组件
   *
   * 基于 InputRenderer 实现，支持自适应高度。
   *
   * @module renderers/TextAreaRenderer
   */
  import { computed, ref, useAttrs, useSlots } from "vue"

  import classNames from "classnames"

  import InputRenderer from "../InputRenderer"

  import type { TextAreaAutosize, TextAreaRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "TextAreaRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<TextAreaRendererProps>(), {
    className: "",
    autosize: () => ({ minRows: 2, maxRows: 6 }),
    autoSize: undefined,
    rows: undefined,
    formItemProps: () => ({}),
    formInstance: null,
    placeholder: undefined,
    readonlyPlaceholder: "-",
    readonly: false,
    disabled: false,
    value: "",
    onChange: () => {},
    onBlur: null,
    onFocus: null,
    align: "right",
    showWordLimit: false,
    error: undefined,
  })

  const attrs = useAttrs()
  const slots = useSlots()

  const inputRef = ref<InstanceType<typeof InputRenderer> | null>(null)

  const readonly = computed(() => props.readonly || props.formItemProps?.readonly)
  const disabled = computed(() => props.disabled || props.formItemProps?.disabled)

  /** 兼容 autoSize 和 autosize */
  const computedAutosize = computed<boolean | TextAreaAutosize>(() => {
    return (props.autoSize ?? props.autosize ?? { minRows: 2, maxRows: 6 }) as
      | boolean
      | TextAreaAutosize
  })

  /** 计算行数 */
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

  defineExpose({
    focus: () => (inputRef.value as any)?.focus?.(),
    blur: () => (inputRef.value as any)?.blur?.(),
  })
</script>
