<template>
  <div :class="['schemx-renderer', 'schemx-sensitive-input-renderer', props.className]">
    <SensitiveInput
      ref="inputRef"
      v-bind="sensitiveInputProps"
      v-model:value="inputValue"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from "vue"

  import SensitiveInput from "@/components/SensitiveInput"

  import type {
    SensitiveInputRendererProps,
    SensitiveInputValue,
  } from "./types"

  defineOptions({
    name: "SensitiveInputRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<SensitiveInputRendererProps>(), {
    value: "",
    onChange: undefined,
    onBlur: undefined,
    onFocus: undefined,
    formatter: undefined,
    maskFormatter: undefined,
    defaultRevealed: false,
    revealed: undefined,
    onRevealChange: undefined,
    revealable: true,
    revealText: "显示",
    hideText: "隐藏",
    revealIcon: "eye-o",
    hideIcon: "closed-eye",
    focusOnReveal: true,
    hideOnBlur: false,
    revealWhenReadonly: false,
    placeholder: "",
    readonlyPlaceholder: "-",
    disabled: false,
    readonly: false,
    align: "right",
    className: "",
  })

  const inputValue = defineModel<SensitiveInputValue>("value")
  const inputRef = ref<InstanceType<typeof SensitiveInput> | null>(null)

  const sensitiveInputProps = computed(() => {
    const { value: _value, ...rest } = props

    return rest
  })

  defineExpose({
    focus: () => inputRef.value?.focus?.(),
    blur: () => inputRef.value?.blur?.(),
  })
</script>
