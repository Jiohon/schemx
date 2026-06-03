<template>
  <div
    v-if="finalReadonly"
    class="schemx-slider-renderer schemx-slider-renderer--readonly"
    :class="className"
  >
    <div class="schemx-slider-renderer__readonly">
      <span class="schemx-slider-renderer__readonly-value">
        {{ formatDisplayValue(sliderValue) }}
      </span>
    </div>
  </div>
  <div
    v-else
    class="schemx-slider-renderer"
    :class="[className, { 'schemx-slider-renderer--disabled': finalDisabled }]"
  >
    <Slider
      v-bind="attrs"
      :model-value="sliderValue"
      :min="min"
      :max="max"
      :step="step"
      :range="range"
      :disabled="finalDisabled"
      @update:model-value="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 滑块渲染器组件
   *
   * 基于 Vant Slider 实现滑块功能。
   *
   * @module renderers/SliderRenderer
   */
  import { computed, useAttrs } from "vue"

  import { Slider } from "vant"

  import type { SliderRendererProps, SliderValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "SliderRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<SliderRendererProps>(), {
    value: 0,
    min: 0,
    max: 100,
    step: 1,
    range: false,
    className: "",
    onChange: () => {},
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
    button: true,
  })

  const attrs = useAttrs()

  const sliderValue = defineModel<SliderValue>("value")

  const fieldProps = computed(() => ({
    readonly: props.readonly || props.formItemProps?.readonly,
    disabled: props.disabled || props.formItemProps?.disabled,
  }))

  const finalReadonly = computed(() => fieldProps.value.readonly)
  const finalDisabled = computed(() => fieldProps.value.disabled)

  /**
   * 处理值变化事件
   */
  const handleChange = (value: SliderValue): void => {
    if (finalDisabled.value || finalReadonly.value) return
    sliderValue.value = value
    props.onChange?.(value)
  }

  /**
   * 格式化显示值
   */
  const formatDisplayValue = (value?: SliderValue): string => {
    if (value === null || value === undefined) {
      return props.readonlyPlaceholder
    }

    if (Array.isArray(value)) {
      return value.join(" - ")
    }

    return String(value)
  }
</script>
