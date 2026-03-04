import { computed, defineComponent, PropType, ref, SetupContext, watchEffect } from "vue"

import { Cascader, Field, Popup } from "vant"

import classNames from "classnames"

import { useDictOptions } from "@/hooks/useDictOptions"
import { createRenderWrapper } from "@/renderer/rendererWrapper"
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
 * - Requirement 13.3: THE migrated renderers SHALL support the new state merging logic
 * - Requirement 13.4: THE migrated renderers SHALL support the new slot merging logic
 * - Requirement 13.5: THE migrated renderers SHALL maintain backward compatibility with existing componentProps
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

    const { remoteOptions } = useDictOptions(attrs as Record<string, any>)

    const placeholder = computed(
      () => props.placeholder || `请选择${props.formItemProps.label}`
    )
    const readonly = computed(() => props.readonly || props.formItemProps?.readonly)
    const disabled = computed(() => props.disabled || props.formItemProps?.disabled)
    const fieldNames = computed(() => props.fieldNames)

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

      return (attrs as Record<string, any>)?.columns
    })

    /**
     * 字段名
     */
    const fieldValue = computed(() => {
      const value = Array.isArray(props.value)
        ? props.value[props.value.length - 1]
        : props.value

      const result = findTreeItem(columns.value, value, {
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

      const valuePath = data.selectedOptions.map((i) => i[fieldNames.value.value!])

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
          "schema-form-renderer",
          "schema-form-cascader-renderer",
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
            class={classNames(
              "schema-form-cascader-popup-renderer",
              props.popupClassName
            )}
            safe-area-inset-bottom
          >
            <Cascader
              modelValue={cascaderValue.value}
              options={columns.value}
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

/**
 * CascaderRenderer - 使用 createRenderWrapper 工厂函数创建的级联选择器渲染器
 *
 * 通过 createRenderWrapper 包装 CascaderRendererComponent，提供：
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
export { CascaderRendererComponent }

// 默认导出原始组件以保持向后兼容性
export default CascaderRendererComponent

// 导出包装后的渲染器（用于 RendererRegistry 注册）
export const CascaderRendererWrapped = createRenderWrapper({
  component: CascaderRendererComponent,
  defaultProps: {
    align: "right",
  },
})
