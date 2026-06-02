<template>
  <div
    v-if="props.readonly"
    class="schemx-radio-renderer"
    :class="className"
    :style="{ textAlign: align }"
  >
    {{ props.readonly ? readonlyPlaceholder : fieldValue }}
  </div>
  <div
    v-else
    class="schemx-renderer schemx-radio-renderer"
    :class="[
      className,
      {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      },
    ]"
  >
    <RadioGroup
      v-bind="attrs"
      :model-value="value"
      :style="{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px 12px',
        justifyContent: align,
        ...(attrs?.style || {}),
      }"
      @update:model-value="onChange"
    >
      <Radio
        v-for="option in options"
        :key="option[valueName]"
        :name="option[valueName]"
        :disabled="disabled || option[disabledName]"
        v-bind="option"
      >
        {{ option[labelName] }}
      </Radio>
    </RadioGroup>
  </div>
</template>

<script setup lang="ts">
  /**
   * 单选框渲染器组件
   *
   * 基于 Vant Radio 组件实现单选功能。
   *
   * @module renderers/RadioRenderer
   */
  import { computed, useAttrs } from "vue"

  import { Radio, RadioGroup } from "vant"

  import { getFieldProps } from "@/utils"

  import type { RadioRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "RadioRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<RadioRendererProps>(), {
    value: undefined,
    onChange: () => {},
    options: () => [],
    className: "",
    fieldNames: () => ({}),
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
  })

  const attrs = useAttrs() as Record<string, any>

  const labelName = computed(() => props.fieldNames?.label || "label")
  const valueName = computed(() => props.fieldNames?.value || "value")
  const disabledName = computed(() => props.fieldNames?.disabled || "disabled")

  const disabled = computed(() => props.disabled || props.formItemProps?.disabled)
  const readonly = computed(() => props.readonly || props.formItemProps?.readonly)
  const align = computed(() => getFieldProps(attrs, "align", "right"))

  const fieldValue = computed(() => {
    return getOption(props.value, labelName.value)
  })

  /**
   * 获取选项的指定字段值
   */
  const getOption = (v: any, key: string): any => {
    const option = props.options.find((option) => option[valueName.value] === v)

    return option ? option[key] : v
  }
</script>
