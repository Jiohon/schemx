<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-picker-renderer', props.className, {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      })
    "
  >
    <Field
      :placeholder="readonly ? props.readonlyPlaceholder : placeholder"
      :readonly="true"
      :disabled="disabled"
      :model-value="fieldValue as string"
      :right-icon="!readonly ? rightIcon : ''"
      :input-align="align"
      @click="handleClick"
    />

    <Popup
      v-if="!readonly && !disabled"
      v-model:show="showPicker"
      round
      position="bottom"
      safe-area-inset-bottom
      :class="classNames('schemx-picker-popup-renderer', props.popupClassName)"
      teleport="body"
    >
      <Picker
        :model-value="modelValue"
        :title="props.title || placeholder"
        :columns="schemas"
        :schemas-field-names="fieldNames"
        v-bind="attrs"
        @confirm="handleConfirm"
        @cancel="handleCancel"
      >
        <template #empty>
          <div class="schemx-picker-empty">No data</div>
        </template>
      </Picker>
    </Popup>
  </div>
</template>

<script setup lang="ts">
  /**
   * 选择渲染器组件
   *
   * 使用 Vant Picker + Popup + Field 组合实现。
   *
   * @module renderers/PickerRenderer
   */
  import { computed, ref, useAttrs } from "vue"

  import { Field, Picker, Popup } from "vant"

  import classNames from "classnames"

  import { findTreeItem, getFieldProps } from "@/utils"

  import type { PickerFieldNames, PickerRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "PickerRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<PickerRendererProps>(), {
    separator: " - ",
    value: undefined,
    showAllLevels: false,
    emitPath: false,
    onConfirm: () => {},
    className: "",
    popupClassName: "",
    onChange: () => {},
    readonlyPlaceholder: "-",
    readonly: false,
    disabled: false,
    title: "",
    options: () => [],
    fieldNames: () => ({ text: "text", value: "value", children: "children" }),
  })

  const attrs = useAttrs()

  const showPicker = ref(false)

  const placeholder = computed(
    () => (attrs as Record<string, any>)?.placeholder || "请选择"
  )

  const readonly = computed(
    () => (attrs as Record<string, any>)?.readonly || props.formItemProps?.readonly
  )

  const disabled = computed(
    () => (attrs as Record<string, any>)?.disabled || props.formItemProps?.disabled
  )

  const rightIcon = computed(() =>
    getFieldProps(attrs as Record<string, any>, "rightIcon", "arrow")
  )

  const align = computed(() =>
    getFieldProps(attrs as Record<string, any>, "align", "right")
  )

  /** 数据源 */
  const schemas = computed(() => {
    if (Array.isArray(props.options) && props.options?.length > 0) {
      return props.options
    }

    return (attrs as Record<string, any>)?.schemas || []
  })

  /** 获取字段名 */
  const fieldNames = computed<PickerFieldNames>(
    () => (attrs as Record<string, any>)?.columnsFieldNames || props?.fieldNames
  )

  /** 获取字段值 */
  const fieldValue = computed(() => {
    const result = findTreeItem(schemas.value, props.value, {
      labelKey: fieldNames.value?.text,
      valueKey: fieldNames.value?.value,
      childrenKey: fieldNames.value?.children,
    })

    const label = props.showAllLevels ? result?.labels : result?.labels.slice(-1)

    return result.labels.length ? label?.join(props.separator) : props.value
  })

  const modelValue = computed(() => {
    return Array.isArray(props.value) ? props.value : [props.value]
  })

  /** 处理确认 */
  const handleConfirm = (values: { selectedValues: any[] }): void => {
    const value = props.emitPath
      ? values.selectedValues
      : values.selectedValues[values.selectedValues.length - 1]

    props.onConfirm?.(value, values)
    props.onChange?.(value, values)
    showPicker.value = false
  }

  /** 处理取消 */
  const handleCancel = (): void => {
    showPicker.value = false
  }

  /** 处理点击 */
  const handleClick = (): void => {
    if (readonly.value || disabled.value) return
    showPicker.value = true
  }

</script>
