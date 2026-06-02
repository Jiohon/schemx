<template>
  <div
    v-if="readonly"
    class="schemx-switch-renderer"
    :class="className"
    :style="{ justifyContent: align }"
  >
    {{ readonly ? readonlyPlaceholder : fieldValue }}
  </div>
  <div
    v-else
    class="schemx-renderer schemx-switch-renderer"
    :class="[
      className,
      {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      },
    ]"
    :style="{ justifyContent: align }"
  >
    <Switch
      size="22px"
      v-bind="attrs"
      :model-value="value"
      :loading="loading"
      :disabled="disabled"
      @update:model-value="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 开关渲染器组件
   *
   * 基于 Vant Switch 封装，支持自定义开关状态文本、
   * 异步值更新、只读/禁用状态继承等能力。
   *
   * @module renderers/SwitchRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import { Switch } from "vant"

  import { getFieldProps } from "@/utils"

  import type { SwitchRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "SwitchRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<SwitchRendererProps>(), {
    value: false,
    onChange: () => {},
    className: "",
    activeText: undefined,
    activeValue: true,
    inactiveValue: false,
    inactiveText: undefined,
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
  })

  const attrs = useAttrs()

  const loading = ref(false)

  const disabled = computed(() => props.disabled || props.formItemProps?.disabled)
  const readonly = computed(() => props.readonly || props.formItemProps?.readonly)
  const align = computed(() =>
    getFieldProps(attrs as Record<string, any>, "align", "right")
  )

  const fieldValue = computed(() => {
    return props.value === props.activeValue ? props.activeText : props.inactiveText
  })

  /**
   * 处理开关值变化
   */
  const handleChange = async (value: boolean | string | number): Promise<void> => {
    if (readonly.value || disabled.value) return

    try {
      loading.value = true

      await props.onChange?.(value)

      loading.value = false
    } catch (error) {
      loading.value = false
    }
  }
</script>
