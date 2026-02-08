import { computed, defineComponent, PropType, SetupContext } from "vue"

import classNames from "classnames"

import { useDictOptions } from "../../hooks/useDictOptions"
import { createRenderWrapper } from "../../renderer/rendererWrapper"
import { getFieldProps } from "../../utils"

import Selector from "./Selector"
import "./index.scss"

export interface SelectorOption {
  label?: string
  value?: string | number
  disabled?: boolean
  [key: string]: any
}

export interface SelectorRendererProps {
  value?: string | number
  onChange?: (value: string | number) => void
  options?: SelectorOption[]
  className?: string
  fieldNames?: {
    label?: string
    value?: string
    disabled?: string
  }
  readonly?: boolean
  readonlyPlaceholder?: string
  disabled?: boolean
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  error?: string[]
}

/**
 * 选择组渲染器组件
 *
 * - Requirement 13.3: THE migrated renderers SHALL support the new state merging logic
 * - Requirement 13.4: THE migrated renderers SHALL support the new slot merging logic
 * - Requirement 13.5: THE migrated renderers SHALL maintain backward compatibility with existing componentProps
 */
const SelectorRendererComponent = defineComponent({
  name: "SelectorRendererComponent",
  props: {
    value: {
      type: [String, Number] as PropType<string | number>,
      default: undefined,
    },
    onChange: {
      type: Function as PropType<(value: string | number) => void>,
      default: () => {},
    },
    options: {
      type: Array as PropType<SelectorOption[]>,
      default: () => [],
    },
    className: {
      type: String,
      default: "",
    },
    fieldNames: {
      type: Object as PropType<{ label?: string; value?: string; disabled?: string }>,
      default: () => ({}),
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    readonlyPlaceholder: {
      type: String,
      default: "-",
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    formItemProps: {
      type: Object as PropType<Record<string, any>>,
      default: () => ({}),
    },
    formInstance: {
      type: Object as PropType<Record<string, any> | null>,
      default: null,
    },
    error: {
      type: Array as PropType<string[]>,
      default: undefined,
    },
  },
  setup(props, { attrs }: SetupContext) {
    const { remoteOptions } = useDictOptions(attrs as Record<string, any>)

    const labelName = computed(() => props.fieldNames?.label || "label")
    const valueName = computed(() => props.fieldNames?.value || "value")

    const disabled = computed(() => props.disabled || props.formItemProps?.disabled)
    const readonly = computed(() => props.readonly || props.formItemProps?.readonly)

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

    const fieldValue = computed(() => {
      return getOption(props.value, labelName.value)
    })

    const getOption = (v: any, key: string): any => {
      const option = columns.value.find(
        (option: SelectorOption) => option[valueName.value] === v
      )

      return option ? option[key] : v
    }

    return () => {
      if (readonly.value) {
        return (
          <div
            class={classNames("schema-form-selector-renderer", props.className)}
            style={{
              textAlign: getFieldProps(attrs as Record<string, any>, "align", "right"),
            }}
          >
            {readonly.value ? props.readonlyPlaceholder : fieldValue.value}
          </div>
        )
      }

      return (
        <div
          class={classNames(
            "schema-form-renderer",
            "schema-form-selector-renderer",
            props.className,
            {
              "schema-form-renderer-readonly": readonly.value,
              "schema-form-renderer-disabled": disabled.value,
            }
          )}
        >
          <Selector
            {...attrs}
            options={columns.value}
            fieldNames={props.fieldNames}
            disabled={disabled.value}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px 12px",
              justifyContent: getFieldProps(
                attrs as Record<string, any>,
                "align",
                "right"
              ),
              ...((attrs as Record<string, any>)?.style || {}),
            }}
            modelValue={props.value}
            onUpdate:modelValue={props.onChange}
          />
        </div>
      )
    }
  },
})

/**
 * SelectorRenderer - 使用 createRenderWrapper 工厂函数创建的选择组渲染器
 *
 * 通过 createRenderWrapper 包装 SelectorRendererComponent，提供：
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
export { SelectorRendererComponent }

// 默认导出原始组件以保持向后兼容性
export default SelectorRendererComponent

// 导出包装后的渲染器（用于 RendererRegistry 注册）
export const SelectorRendererWrapped = createRenderWrapper({
  component: SelectorRendererComponent,
  defaultProps: {
    align: "right",
  },
})
