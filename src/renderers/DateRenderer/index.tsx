import { computed, defineComponent, PropType, ref, SetupContext } from "vue"

import { DatePicker, Field, Popup } from "vant"

import classNames from "classnames"
import dayjs from "dayjs"

import { createRenderWrapper } from "../../renderer/rendererWrapper"
import { getFieldProps } from "../../utils"
import "./index.scss"

export interface DateRendererProps {
  value?: string | string[] | Date
  onConfirm?: (value: string) => void
  format?: string | ((value: any) => string)
  className?: string
  popupClassName?: string
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  onChange?: (value: string) => void
  placeholder?: string
  readonly?: boolean
  readonlyPlaceholder?: string
  disabled?: boolean
  error?: string[]
}

/**
 * 日期选择渲染器组件
 * 支持 date、time、datetime、dateTime 类型
 * 使用 Vant DatePicker + Popup + Field 组合实现
 *
 * - Requirement 13.3: THE migrated renderers SHALL support the new state merging logic
 * - Requirement 13.4: THE migrated renderers SHALL support the new slot merging logic
 * - Requirement 13.5: THE migrated renderers SHALL maintain backward compatibility with existing componentProps
 */
const DateRendererComponent = defineComponent({
  name: "DateRendererComponent",
  props: {
    value: {
      type: [String, Array, Date] as PropType<string | string[] | Date>,
      default: "",
    },
    onConfirm: {
      type: Function as PropType<(value: string) => void>,
      default: () => {},
    },
    format: {
      type: [String, Function] as PropType<string | ((value: any) => string)>,
      default: "YYYY-MM-DD",
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
      type: Function as PropType<(value: string) => void>,
      default: () => {},
    },
    placeholder: {
      type: String,
      default: undefined,
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
    error: {
      type: Array as PropType<string[]>,
      default: undefined,
    },
  },

  setup(props, { attrs, slots }: SetupContext) {
    const placeholder = computed(
      () => props.placeholder || `请选择${props.formItemProps.label}`
    )

    const readonly = computed(() => props.readonly || props.formItemProps?.readonly)
    const disabled = computed(() => props.disabled || props.formItemProps?.disabled)

    const showPicker = ref(false)

    // 获取值的函数，支持String, Array, Date三种类型
    const getValue = (value: string | string[] | Date | null | undefined): string => {
      if (!value) return ""

      let dateValue: dayjs.Dayjs

      if (typeof value === "string") {
        dateValue = dayjs(value)
      } else if (Array.isArray(value)) {
        if (value.length === 0) return ""
        dateValue = dayjs(value.join("-"))
      } else if (value instanceof Date) {
        dateValue = dayjs(value)
      } else {
        dateValue = dayjs(value)
      }

      const formatStr = typeof props.format === "string" ? props.format : "YYYY-MM-DD"

      return dateValue.format(formatStr)
    }

    const fieldValue = computed(() => {
      return getValue(props.value)
    })

    const modelValue = computed(() => {
      const value = getValue(props.value) || new Date().toISOString()
      const dateValue = dayjs(value).format("YYYY-MM-DD").split("-")

      return dateValue
    })

    const handleConfirm = ({ selectedValues }: { selectedValues: string[] }): void => {
      const formattedValue = getValue(selectedValues)
      props.onConfirm?.(formattedValue)
      props.onChange?.(formattedValue)
      showPicker.value = false
    }

    const handleCancel = (): void => {
      showPicker.value = false
    }

    const handleClick = (): void => {
      if (readonly.value || disabled.value) return
      showPicker.value = true
    }

    return () => (
      <div
        class={classNames(
          "schema-form-renderer",
          "schema-form-date-renderer",
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
          rightIcon={
            !readonly.value
              ? getFieldProps(attrs as Record<string, any>, "rightIcon", "arrow")
              : ""
          }
          inputAlign={getFieldProps(attrs as Record<string, any>, "align", "right")}
          modelValue={fieldValue.value}
          onClick={handleClick}
          v-slots={slots}
        />

        {!readonly.value && !disabled.value && (
          <Popup
            v-model:show={showPicker.value}
            position="bottom"
            class={classNames("schema-form-date-popup-renderer", props.popupClassName)}
            teleport="body"
          >
            <DatePicker
              modelValue={modelValue.value}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              title={placeholder.value}
              {...attrs}
            />
          </Popup>
        )}
      </div>
    )
  },
})

/**
 * DateRenderer - 使用 createRenderWrapper 工厂函数创建的日期选择渲染器
 *
 * 通过 createRenderWrapper 包装 DateRendererComponent，提供：
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
export { DateRendererComponent }

// 默认导出原始组件以保持向后兼容性
export default DateRendererComponent

// 导出包装后的渲染器（用于 RendererRegistry 注册）
export const DateRendererWrapped = createRenderWrapper({
  component: DateRendererComponent,
  defaultProps: {
    align: "right",
  },
})
