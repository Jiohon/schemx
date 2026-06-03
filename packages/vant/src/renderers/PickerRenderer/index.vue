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
      :placeholder="readonly ? props.readonlyPlaceholder : displayPlaceholder"
      :readonly="true"
      :disabled="disabled"
      :model-value="fieldValue as string"
      right-icon="arrow"
      :input-align="contentAlign"
      @click="handleClick"
    />

    <Popup
      v-if="!readonly && !disabled"
      v-model:show="showPicker"
      :class="classNames('schemx-picker-popup-renderer', props.popupClassName)"
      v-bind="popupProps"
    >
      <Picker
        :model-value="modelValue"
        :title="props.title || displayPlaceholder"
        :columns="columns"
        :columns-field-names="fieldNames"
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
  import type { FieldTextAlign, PickerConfirmEventParams } from "vant"

  import classNames from "classnames"

  import { findTreeItem, getFieldProps } from "@/utils"

  import type { PickerFieldNames, PickerRendererProps, PickerValue } from "./types"

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

  const pickerValue = defineModel<PickerValue>("value")

  const showPicker = ref(false)

  const displayPlaceholder = computed(() => props?.placeholder || "请选择")

  const readonly = computed(() => props?.readonly || props.formItemProps?.readonly)

  const disabled = computed(() => props?.disabled || props.formItemProps?.disabled)

  const contentAlign = computed(
    () => getFieldProps(props, "contentAlign", "right") as FieldTextAlign
  )

  const popupProps = computed(() => ({
    round: true,
    position: "bottom" as const,
    safeAreaInsetBottom: true,
    teleport: "body",
    ...props.popupProps,
  }))

  /** 数据源 */
  const columns = computed(() => {
    if (Array.isArray(props.options) && props.options?.length > 0) {
      return props.options
    }

    return props?.columns || []
  })

  /** 获取字段名 */
  const fieldNames = computed<PickerFieldNames>(
    () => props?.columnsFieldNames || props?.fieldNames
  )

  /** 获取字段值 */
  const fieldValue = computed(() => {
    const result = findTreeItem(columns.value, pickerValue.value, {
      labelKey: fieldNames.value?.text,
      valueKey: fieldNames.value?.value,
      childrenKey: fieldNames.value?.children,
    })

    const label = props.showAllLevels ? result?.labels : result?.labels.slice(-1)

    return result.labels.length ? label?.join(props.separator) : pickerValue.value
  })

  const modelValue = computed(() => {
    if (
      pickerValue.value === undefined ||
      pickerValue.value === null ||
      pickerValue.value === ""
    ) {
      return []
    }

    return Array.isArray(pickerValue.value) ? pickerValue.value : [pickerValue.value]
  })

  /** 处理确认 */
  const handleConfirm = (values: PickerConfirmEventParams): void => {
    const value = props.emitPath
      ? values.selectedValues
      : values.selectedValues[values.selectedValues.length - 1]

    pickerValue.value = value

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
