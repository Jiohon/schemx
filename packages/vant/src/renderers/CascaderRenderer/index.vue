<template>
  <div
    :class="
      classNames('schemx-renderer', 'schemx-cascader-renderer', props.className, {
        'schemx-renderer-readonly': readonly,
        'schemx-renderer-disabled': disabled,
      })
    "
  >
    <Field
      :placeholder="readonly ? props.readonlyPlaceholder : placeholder"
      :readonly="true"
      :disabled="disabled"
      :model-value="fieldValue?.toString()"
      :right-icon="!readonly ? rightIcon : ''"
      :input-align="align"
      @click="handleClick"
    />

    <Popup
      v-if="!readonly && !disabled"
      v-model:show="showCascader"
      round
      position="bottom"
      :class="classNames('schemx-cascader-popup-renderer', props.popupClassName)"
      safe-area-inset-bottom
    >
      <Cascader
        :model-value="cascaderValue"
        :options="schemas"
        :title="props.title ?? placeholder"
        :placeholder="placeholder"
        :field-names="fieldNames"
        v-bind="attrs"
        @finish="handleConfirm"
        @close="handleClose"
      />
    </Popup>
  </div>
</template>

<script setup lang="ts">
  /**
   * 级联选择器渲染器组件
   *
   * @module renderers/CascaderRenderer
   */
  import { computed, ref, useAttrs, watchEffect } from "vue"

  import { Cascader, Field, Popup } from "vant"

  import classNames from "classnames"

  import { findTreeItem, getFieldProps } from "@/utils"

  import type { CascaderFieldNames, CascaderRendererProps } from "./types"

  import "./index.scss"

  defineOptions({
    name: "CascaderRendererComponent",
    inheritAttrs: false,
  })

  const props = withDefaults(defineProps<CascaderRendererProps>(), {
    value: () => [],
    onConfirm: undefined,
    className: "",
    showAllLevels: true,
    emitPath: true,
    fieldNames: () => ({ text: "label", value: "value", children: "children" }),
    separator: " - ",
    placeholder: undefined,
    readonlyPlaceholder: "-",
    readonly: false,
    disabled: false,
    onChange: () => {},
    options: () => [],
    title: undefined,
    formItemProps: () => ({}),
    formInstance: null,
    popupClassName: "",
    error: undefined,
  })

  const attrs = useAttrs()

  const showCascader = ref(false)

  const placeholder = computed(
    () => props.placeholder || `请选择${props.formItemProps.label}`
  )

  const readonly = computed(() => props.readonly || props.formItemProps?.readonly)
  const disabled = computed(() => props.disabled || props.formItemProps?.disabled)

  const rightIcon = computed(() =>
    getFieldProps(attrs as Record<string, any>, "rightIcon", "arrow")
  )

  const align = computed(() =>
    getFieldProps(attrs as Record<string, any>, "align", "right")
  )

  const fieldNames = computed<CascaderFieldNames>(() => props.fieldNames)

  /** 数据源 */
  const schemas = computed(() => {
    if (Array.isArray(props.options) && props.options?.length > 0) {
      return props.options
    }

    return (attrs as Record<string, any>)?.schemas
  })

  /** 字段值 */
  const fieldValue = computed(() => {
    const value = Array.isArray(props.value)
      ? props.value[props.value.length - 1]
      : props.value

    const result = findTreeItem(schemas.value, value, {
      labelKey: fieldNames.value.text,
      valueKey: fieldNames.value.value,
      childrenKey: fieldNames.value.children,
    })

    const label = props.showAllLevels ? result?.labels : result?.labels.slice(-1)

    return label?.join(props.separator) || props.value
  })

  /** 级联选择器值 */
  const cascaderValue = computed(() => {
    return Array.isArray(props.value) ? props.value[props.value.length - 1] : props.value
  })

  const handleClick = (): void => {
    if (readonly.value || disabled.value) return
    showCascader.value = true
  }

  const handleConfirm = (data: { selectedOptions: any[]; value: any }): void => {
    if (readonly.value || disabled.value) return

    const valueKey = fieldNames.value.value || "value"
    const valuePath = data.selectedOptions.map((i) => i[valueKey])

    const value = props.emitPath ? valuePath : [data.value]

    props.onConfirm?.(value)
    props.onChange?.(value)
    showCascader.value = false
  }

  const handleClose = (): void => {
    showCascader.value = false
    ;(attrs as Record<string, any>).onClose?.()
  }

  /** 监听值变化, 设置表单值 */
  watchEffect(
    () => {
      props.formInstance?.setFieldValue(`${props.formItemProps.name}`, fieldValue.value)
    },
    { flush: "post" }
  )
</script>
