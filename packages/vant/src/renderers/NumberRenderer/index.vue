<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-number-renderer', props.className, {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      })
    "
  >
    <InputRenderer
      ref="inputRef"
      :type="props.type"
      :value="props.value?.toString() || ''"
      :placeholder="props.placeholder"
      :readonly-placeholder="props.readonlyPlaceholder"
      :readonly="readonly"
      :disabled="disabled"
      :align="props.align"
      :form-item-props="props.formItemProps"
      :min="props.min"
      :max="props.max"
      :maxlength="props.maxlength"
      :clearable="props.clearable"
      @change="handleChange"
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
   * 数字输入渲染器组件
   *
   * 支持 number、digit 类型，基于 InputRenderer 实现。
   *
   * @module renderers/NumberRenderer
   */
  import { computed, ref, useAttrs, useSlots } from "vue"

  import classNames from "classnames"

  import InputRenderer from "../InputRenderer"

  import type { NumberRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "NumberRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<NumberRendererProps>(), {
    className: "",
    type: "number",
    formItemProps: () => ({}),
    formInstance: null,
    placeholder: undefined,
    readonlyPlaceholder: "-",
    readonly: false,
    disabled: false,
    value: "",
    onChange: () => {},
    onBlur: undefined,
    onFocus: undefined,
    align: "right",
    clearable: false,
    min: undefined,
    max: undefined,
    error: undefined,
  })

  const attrs = useAttrs()
  const slots = useSlots()

  const inputRef = ref<InstanceType<typeof InputRenderer> | null>(null)

  const readonly = computed(() => props.readonly || props.formItemProps?.readonly)
  const disabled = computed(() => props.disabled || props.formItemProps?.disabled)

  /**
   * 处理值变化
   *
   * 保持字符串形式，让 InputRenderer 处理格式化。
   */
  const handleChange = (value: string): void => {
    if (value === "" || value === null || value === undefined) {
      props.onChange?.("")

      return
    }

    props.onChange?.(value)
  }

  defineExpose({
    focus: () => (inputRef.value as any)?.focus?.(),
    blur: () => (inputRef.value as any)?.blur?.(),
  })
</script>
