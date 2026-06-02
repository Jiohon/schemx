<template>
  <div
    v-if="finalReadonly"
    class="schemx-rate-renderer schemx-rate-renderer--readonly"
    :class="className"
  >
    <Rate
      v-if="value"
      :model-value="value"
      :count="count"
      :allow-half="allowHalf"
      readonly
    />
    <span v-else class="schemx-rate-renderer__readonly-placeholder">
      {{ readonlyPlaceholder }}
    </span>
  </div>
  <div
    v-else
    class="schemx-rate-renderer"
    :class="[className, { 'schemx-rate-renderer--disabled': finalDisabled }]"
  >
    <Rate
      v-bind="attrs"
      :model-value="value"
      :count="count"
      :allow-half="allowHalf"
      :disabled="finalDisabled"
      @update:model-value="onChange"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 评分渲染器组件
   *
   * 基于 Vant Rate 组件实现评分功能。
   *
   * @module renderers/RateRenderer
   */
  import { computed, useAttrs } from "vue"

  import { Rate } from "vant"

  import type { RateRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "RateRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<RateRendererProps>(), {
    value: 0,
    count: 5,
    allowHalf: false,
    className: "",
    onChange: () => {},
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
  })

  const attrs = useAttrs()

  const finalReadonly = computed(() => props.readonly || props.formItemProps?.readonly)
  const finalDisabled = computed(() => props.disabled || props.formItemProps?.disabled)
</script>
