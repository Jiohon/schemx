import { computed, defineComponent, PropType, ref, SetupContext, watchEffect } from "vue"

import { Cascader, Field, Popup } from "vant"

import { useDictionary } from "@schemx/vue"
import classNames from "classnames"

import { findTreeItem, getFieldProps } from "@/utils"
import "./index.scss"

export interface CascaderRendererProps {
  value?: any[] | string | number
  onConfirm?: (value: any[]) => void
  className?: string
  showAllLevels?: boolean
  emitPath?: boolean
  fieldNames?: {
    text?: string
    value?: string
    children?: string
  }
  separator?: string
  placeholder?: string
  readonlyPlaceholder?: string
  readonly?: boolean
  disabled?: boolean
  onChange?: (value: any[]) => void
  options?: any[]
  title?: string
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  popupClassName?: string
  error?: string[]
}

/**
 * 级联选择器渲染器组件
 *
 */
const CascaderRendererComponent = defineComponent({
  name: "CascaderRendererComponent",
  props: {
    value: {
      type: [Array, String, Number] as PropType<any[] | string | number>,
      default: () => [],
    },
    onConfirm: {
      type: Function as PropType<(value: any[]) => void>,
      default: null,
    },
    className: {
      type: String,
      default: "",
    },
    showAllLevels: {
      type: Boolean,
      default: true,
    },
    emitPath: {
      type: Boolean,
      default: true,
    },
    fieldNames: {
      type: Object as PropType<{ text?: string; value?: string; children?: string }>,
      default: () => ({ text: "label", value: "value", children: "children" }),
    },
    separator: {
      type: String,
      default: " - ",
    },
    placeholder: {
      type: String,
      default: undefined,
    },
    readonlyPlaceholder: {
      type: String,
      default: "-",
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    onChange: {
      type: Function as PropType<(value: any[]) => void>,
      default: () => {},
    },
    options: {
      type: Array as PropType<any[]>,
      default: () => [],
    },
    title: {
      type: String,
      default: undefined,
    },
    formItemProps: {
      type: Object as PropType<Record<string, any>>,
      default: () => ({}),
    },
    formInstance: {
      type: Object as PropType<Record<string, any> | null>,
      default: null,
    },
    popupClassName: {
      type: String,
      default: "",
    },
    error: {
      type: Array as PropType<string[]>,
      default: undefined,
    },
  },
  setup(props, { attrs, slots }: SetupContext) {
    const showCascader = ref(false)

    const { list } = useDictionary(attrs as Record<string, any>)

    const placeholder = computed(
      () => props.placeholder || `请选择${props.formItemProps.label}`
    )
    const readonly = computed(() => props.readonly || props.formItemProps?.readonly)
    const disabled = computed(() => props.disabled || props.formItemProps?.disabled)
    const fieldNames = computed(() => props.fieldNames)

    /**
     * 数据源
     */
    const schemas = computed(() => {
      if (Array.isArray(list.value) && list.value?.length > 0) {
        return list.value
      }

      if (Array.isArray(props.options) && props.options?.length > 0) {
        return props.options
      }

      return (attrs as Record<string, any>)?.schemas
    })

    /**
     * 字段名
     */
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

    /**
     * 字段值
     */
    const cascaderValue = computed(() => {
      return Array.isArray(props.value)
        ? props.value[props.value.length - 1]
        : props.value
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

    /**
     * 监听值变化, 设置表单值
     */
    watchEffect(
      () => {
        props.formInstance?.setFieldValue(`${props.formItemProps.name}`, fieldValue.value)
      },
      { flush: "post" }
    )

    return () => (
      <div
        class={classNames(
          "schemx-renderer",
          "schemx-cascader-renderer",
          props.className,
          {
            "schemx-renderer-readonly": readonly.value,
            "schemx-renderer-disabled": disabled.value,
          }
        )}
      >
        <Field
          placeholder={readonly.value ? props.readonlyPlaceholder : placeholder.value}
          readonly={true}
          disabled={disabled.value}
          modelValue={fieldValue.value?.toString()}
          rightIcon={
            !readonly.value
              ? getFieldProps(attrs as Record<string, any>, "rightIcon", "arrow")
              : ""
          }
          inputAlign={getFieldProps(attrs as Record<string, any>, "align", "right")}
          onClick={handleClick}
          v-slots={slots}
        />

        {!readonly.value && !disabled.value && (
          <Popup
            v-model:show={showCascader.value}
            round
            position="bottom"
            class={classNames("schemx-cascader-popup-renderer", props.popupClassName)}
            safe-area-inset-bottom
          >
            <Cascader
              modelValue={cascaderValue.value}
              options={schemas.value}
              title={props.title ?? placeholder.value}
              placeholder={placeholder.value}
              onFinish={handleConfirm}
              {...attrs}
              onClose={handleClose}
              fieldNames={fieldNames.value}
            />
          </Popup>
        )}
      </div>
    )
  },
})

export default CascaderRendererComponent
