<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-calendar-renderer', props.className, {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      })
    "
  >
    <Field
      :placeholder="readonly ? props.readonlyPlaceholder : placeholder"
      :readonly="true"
      :disabled="disabled"
      :model-value="modelValue"
      :right-icon="!readonly ? rightIcon : ''"
      :input-align="align"
      @click="handleClick"
    />

    <Calendar
      v-if="!readonly && !disabled"
      v-model:show="showCalendar"
      :type="props.type"
      :title="title"
      show-confirm
      :min-date="minDate"
      :max-date="maxDate"
      v-bind="attrs"
      @confirm="handleConfirm"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 日历选择器渲染器组件
   *
   * 使用 Vant Calendar + Field 组合实现。
   *
   * @module renderers/CalendarRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import { Calendar, Field } from "vant"

  import classNames from "classnames"
  import dayjs from "dayjs"

  import { getFieldProps } from "@/utils"

  import type { CalendarRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "CalendarRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<CalendarRendererProps>(), {
    value: "",
    onConfirm: () => {},
    className: "",
    popupClassName: "",
    placeholder: "",
    onChange: () => {},
    readonly: false,
    readonlyPlaceholder: "-",
    disabled: false,
    type: "single",
    format: "YYYY-MM-DD",
    separator: " - ",
  })

  const attrs = useAttrs()

  const showCalendar = ref(false)

  const minDate = new Date(1970, 0, 1)
  const maxDate = dayjs().add(10, "year").toDate()

  const placeholder = computed(() => props?.placeholder || "请选择")

  const readonly = computed(() => props?.readonly || props.formItemProps?.readonly)

  const disabled = computed(() => props?.disabled || props.formItemProps?.disabled)

  const rightIcon = computed(() =>
    getFieldProps(attrs as Record<string, any>, "rightIcon", "arrow")
  )

  const align = computed(() =>
    getFieldProps(attrs as Record<string, any>, "align", "right")
  )

  const modelValue = computed(() => {
    const value = getValue(props.value)

    return Array.isArray(value) ? value.join(props.separator) : value
  })

  const title = computed(() => {
    return (attrs as Record<string, any>)?.title || placeholder.value
  })

  /**
   * 获取值的函数
   *
   * 支持 String, Array, Date 三种类型。
   */
  const getValue = (
    value: string | string[] | Date | null | undefined
  ): string | string[] => {
    if (!value) return ""

    if (Array.isArray(value)) {
      return value.map((i) => dayjs(i).format(props.format))
    } else {
      return dayjs(value).format(props.format)
    }
  }

  const handleConfirm = (date: Date | Date[]): void => {
    if (readonly.value || disabled.value) return

    const value = getValue(date as any)

    props.onConfirm?.(value)
    props.onChange?.(value)
    showCalendar.value = false
  }

  const handleClick = (): void => {
    if (readonly.value || disabled.value) return
    showCalendar.value = true
  }
</script>
