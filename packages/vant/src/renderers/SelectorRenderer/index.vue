<template>
  <div
    v-if="readonly"
    class="schemx-selector-renderer"
    :class="className"
    :style="{ textAlign: align }"
  >
    {{ readonly ? readonlyPlaceholder : fieldValue }}
  </div>
  <div
    v-else
    class="schemx-renderer schemx-selector-renderer"
    :class="[
      className,
      {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      },
    ]"
  >
    <Selector
      v-bind="attrs"
      :options="options"
      :field-names="fieldNames"
      :disabled="disabled"
      :model-value="selectorValue"
      :style="{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px 12px',
        justifyContent: align,
        ...(attrs?.style || {}),
      }"
      @update:model-value="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 选择组渲染器组件
   *
   * 基于 Selector 子组件实现选择功能。
   *
   * @module renderers/SelectorRenderer
   */
  import { computed, useAttrs } from "vue"

  import { getFieldProps } from "@/utils"

  import Selector from "./Selector.vue"

  import type { SelectorOption, SelectorRendererProps, SelectValue } from "./types"

  import "./index.scss"

  defineOptions({
    name: "SelectorRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<SelectorRendererProps>(), {
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

  const selectorValue = defineModel<SelectValue>("value")

  const labelName = computed(() => props.fieldNames?.label || "label")
  const valueName = computed(() => props.fieldNames?.value || "value")

  const disabled = computed(() => props.disabled || props.formItemProps?.disabled)
  const readonly = computed(() => props.readonly || props.formItemProps?.readonly)
  const align = computed(() => getFieldProps(attrs, "align", "right"))

  const fieldValue = computed(() => {
    return getOption(selectorValue.value, labelName.value)
  })

  const handleChange = (value: SelectValue): void => {
    selectorValue.value = value
    props.onChange?.(value)
  }

  /**
   * 获取选项的指定字段值
   */
  const getOption = (v: any, key: string): any => {
    const option = props.options.find(
      (option: SelectorOption) => option[valueName.value] === v
    )

    return option ? option[key] : v
  }
</script>
