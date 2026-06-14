<script setup lang="ts">
  import { computed } from "vue"

  import classNames from "classnames"

  import { getReadonlyDisplayValue, resolveRendererMode } from "@/utils"

  type DisplayTextAlign = "left" | "right" | "center"

  interface Props {
    value?: unknown
    placeholder?: string
    readonlyPlaceholder?: string
    align?: DisplayTextAlign
    className?: string
    disabled?: boolean
    readonly?: boolean
  }

  defineOptions({
    name: "SchemxDisplayText",
  })

  const props = withDefaults(defineProps<Props>(), {
    placeholder: "",
    readonlyPlaceholder: "-",
    align: "right",
    className: "",
    disabled: false,
    readonly: false,
  })

  const mode = computed(() =>
    resolveRendererMode({
      disabled: props.disabled,
      readonly: props.readonly,
    })
  )

  const displayValue = computed(() => {
    const placeholder =
      mode.value === "readonly" ? props.readonlyPlaceholder : props.placeholder

    return getReadonlyDisplayValue(props.value, placeholder)
  })

  const displayClass = computed(() =>
    classNames(
      "schemx-display-text",
      `schemx-display-text--${props.align}`,
      `schemx-display-text--${mode.value}`,
      props.className
    )
  )
</script>

<template>
  <span :class="displayClass">{{ displayValue }}</span>
</template>

<style lang="scss">
  .schemx-display-text {
    display: block;
    width: 100%;
    min-width: 0;
    color: var(--van-field-input-text-color, var(--van-text-color, #323233));
    line-height: inherit;
    word-break: break-word;
    font-size: var(--schemx-font-size-md);

    &--left {
      text-align: left;
    }

    &--center {
      text-align: center;
    }

    &--right {
      text-align: right;
    }

    &--disabled {
      color: var(--schemx-disabled-color);
    }
  }
</style>
