import { computed, defineComponent, PropType, ref, SetupContext, watchEffect } from "vue"

import { Field, Picker, Popup } from "vant"

import classNames from "classnames"

import { useDictOptions } from "../../hooks/useDictOptions"
import { createRenderWrapper } from "../../renderer/rendererWrapper"
import { findTreeItem, getFieldProps } from "../../utils"
import "./index.scss"

export interface PickerRendererProps {
  separator?: string
  value?: any[] | string | number
  showAllLevels?: boolean
  emitPath?: boolean
  onConfirm?: (value: any, values: any) => void
  className?: string
  popupClassName?: string
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  onChange?: (value: any, values: any) => void
  readonlyPlaceholder?: string
  readonly?: boolean
  disabled?: boolean
  title?: string
  options?: any[]
  fieldNames?: {
    text?: string
    value?: string
    children?: string
  }
  error?: string[]
}

/**
 * 选择渲染器组件
 * 使用 Vant Picker + Popup + Field 组合实现
 *
 * - Requirement 13.3: THE migrated renderers SHALL support the new state merging logic
 * - Requirement 13.4: THE migrated renderers SHALL support the new slot merging logic
 * - Requirement 13.5: THE migrated renderers SHALL maintain backward compatibility with existing componentProps
 */
const PickerRendererComponent = defineComponent({
  name: "PickerRendererComponent",
  props: {
    separator: {
      type: String,
      default: " - ",
    },
    value: {
      type: [Array, String, Number] as PropType<any[] | string | number>,
      default: undefined,
    },
    showAllLevels: {
      type: Boolean,
      default: false,
    },
    emitPath: {
      type: Boolean,
      default: false,
    },
    onConfirm: {
      type: Function as PropType<(value: any, values: any) => void>,
      default: () => {},
    },
    className: {
      type: String,
      default: "",
    },
    popupClassName: {
      type: String,
      default: "",
    },
    formItemProps: {
      type: Object as PropType<Record<string, any>>,
      default: () => ({}),
    },
    formInstance: {
      type: Object as PropType<Record<string, any> | null>,
      default: null,
    },
    onChange: {
      type: Function as PropType<(value: any, values: any) => void>,
      default: () => {},
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
    title: {
      type: String,
      default: "",
    },
    options: {
      type: Array as PropType<any[]>,
      default: () => [],
    },
    fieldNames: {
      type: Object as PropType<{ text?: string; value?: string; children?: string }>,
      default: () => ({ text: "text", value: "value", children: "children" }),
    },
    error: {
      type: Array as PropType<string[]>,
      default: undefined,
    },
  },
  setup(props, { attrs, slots }: SetupContext) {
    const { remoteOptions } = useDictOptions(attrs as Record<string, any>)

    const showPicker = ref(false)

    const placeholder = computed(
      () =>
        (attrs as Record<string, any>)?.placeholder ||
        `请选择${props.formItemProps.label}`
    )
    const readonly = computed(
      () => (attrs as Record<string, any>)?.readonly || props.formItemProps?.readonly
    )
    const disabled = computed(
      () => (attrs as Record<string, any>)?.disabled || props.formItemProps?.disabled
    )

    /**
     * 数据源
     */
    const columns = computed(() => {
      if (Array.isArray(remoteOptions.value) && remoteOptions.value?.length > 0) {
        return remoteOptions.value
      }

      if (Array.isArray(props.options) && props.options?.length > 0) {
        return props.options
      }

      return (attrs as Record<string, any>)?.columns || []
    })

    /**
     * 获取字段名
     */
    const fieldNames = computed(
      () => (attrs as Record<string, any>)?.columnsFieldNames || props?.fieldNames
    )

    /**
     * 获取字段值
     */
    const fieldValue = computed(() => {
      const result = findTreeItem(columns.value, props.value, {
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

    /**
     * 处理确认
     */
    const handleConfirm = (values: { selectedValues: any[] }): void => {
      const value = props.emitPath
        ? values.selectedValues
        : values.selectedValues[values.selectedValues.length - 1]

      props.onConfirm?.(value, values)
      props.onChange?.(value, values)
      showPicker.value = false
    }

    /**
     * 处理取消
     */
    const handleCancel = (): void => {
      showPicker.value = false
    }

    /**
     * 处理点击
     */
    const handleClick = (): void => {
      if (readonly.value || disabled.value) return
      showPicker.value = true
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
          "schema-form-renderer",
          "schema-form-picker-renderer",
          props.className,
          {
            "schema-form-renderer-readonly": readonly.value,
            "schema-form-renderer-disabled": disabled.value,
          }
        )}
      >
        <Field
          placeholder={readonly.value ? props.readonlyPlaceholder : placeholder.value}
          readonly={true}
          disabled={disabled.value}
          modelValue={fieldValue.value as string}
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
            v-model:show={showPicker.value}
            round
            position="bottom"
            safe-area-inset-bottom
            class={classNames("schema-form-picker-popup-renderer", props.popupClassName)}
            teleport="body"
          >
            <Picker
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              {...attrs}
              modelValue={modelValue.value}
              title={props.title || placeholder.value}
              columns={columns.value}
              columns-field-names={fieldNames.value}
              v-slots={{
                empty: () => <div class="schema-form-picker-empty">No data</div>,
              }}
            />
          </Popup>
        )}
      </div>
    )
  },
})

/**
 * PickerRenderer - 使用 createRenderWrapper 工厂函数创建的选择渲染器
 *
 * 通过 createRenderWrapper 包装 PickerRendererComponent，提供：
 * - 状态合并（readonly, disabled）从 props、formItemProps 和 formContext
 * - 插槽合并（模板插槽和配置插槽）
 * - 值绑定（value, onChange）
 * - 错误显示
 * - 默认占位符生成
 *
 * - Requirement 13.3: THE migrated renderers SHALL support the new state merging logic
 * - Requirement 13.4: THE migrated renderers SHALL support the new slot merging logic
 * - Requirement 13.5: THE migrated renderers SHALL maintain backward compatibility with existing componentProps
 */
// 导出原始组件（用于向后兼容）
export { PickerRendererComponent }

// 默认导出原始组件以保持向后兼容性
export default PickerRendererComponent

// 导出包装后的渲染器（用于 RendererRegistry 注册）
export const PickerRendererWrapped = createRenderWrapper({
  component: PickerRendererComponent,
  defaultProps: {
    align: "right",
  },
})
