<template>
  <div
    v-if="finalReadonly"
    class="schemx-stepper-renderer schemx-stepper-renderer--readonly"
    :class="className"
  >
    <div class="schemx-stepper-renderer__readonly">
      <span class="schemx-stepper-renderer__readonly-value">
        {{ formatDisplayValue(value) }}
      </span>
    </div>
  </div>
  <div
    v-else
    class="schemx-stepper-renderer"
    :class="[className, { 'schemx-stepper-renderer--disabled': finalDisabled }]"
  >
    <Stepper
      v-bind="attrs"
      :model-value="value"
      :min="min"
      :max="max"
      :step="step"
      :integer="integer"
      :decimal-length="decimalLength"
      :disabled="finalDisabled"
      :allow-empty="allowEmpty"
      @update:model-value="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 步进器渲染器组件
   *
   * 基于 Vant Stepper 实现数值调节功能。
   *
   * @module renderers/StepperRenderer
   */
  import { computed, useAttrs } from "vue"

  import { Stepper } from "vant"

  import type { StepperRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "StepperRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<StepperRendererProps>(), {
    value: 0,
    min: undefined,
    max: undefined,
    step: 1,
    integer: false,
    decimalLength: undefined,
    className: "",
    onChange: () => {},
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
    allowEmpty: false,
  })

  const attrs = useAttrs()

  const fieldProps = computed(() => ({
    readonly: props.readonly || props.formItemProps?.readonly,
    disabled: props.disabled || props.formItemProps?.disabled,
  }))

  const finalReadonly = computed(() => fieldProps.value.readonly)
  const finalDisabled = computed(() => fieldProps.value.disabled)

  /**
   * 处理值变化事件
   */
  const handleChange = (value: number): void => {
    if (finalDisabled.value || finalReadonly.value) return
    props.onChange?.(value)
  }

  /**
   * 格式化显示值
   */
  const formatDisplayValue = (value?: number): string => {
    if (
      value === null ||
      value === undefined ||
      (value === ("" as any) && !props.allowEmpty)
    ) {
      return props.readonlyPlaceholder
    }

    return String(value)
  }
</script>
