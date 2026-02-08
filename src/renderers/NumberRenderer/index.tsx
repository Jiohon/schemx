import { computed, defineComponent, PropType, ref, SetupContext } from "vue"

import classNames from "classnames"

import { createRenderWrapper } from "../../renderer/rendererWrapper"
import InputRenderer from "../InputRenderer"
import "./index.scss"

export interface NumberRendererProps {
  className?: string
  type?: "number" | "digit"
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  placeholder?: string
  readonlyPlaceholder?: string
  readonly?: boolean
  disabled?: boolean
  value?: string | number
  onChange?: (value: string) => void
  onBlur?: (event: FocusEvent) => void
  onFocus?: (event: FocusEvent) => void
  align?: "left" | "center" | "right"
  clearable?: boolean
  min?: number
  max?: number
  error?: string[]
}

/**
 * 数字输入渲染器组件
 * 支持 number、digit 类型
 * 基于 InputRenderer 实现
 *
 * - Requirement 13.3: THE migrated renderers SHALL support the new state merging logic
 * - Requirement 13.4: THE migrated renderers SHALL support the new slot merging logic
 * - Requirement 13.5: THE migrated renderers SHALL maintain backward compatibility with existing componentProps
 */
const NumberRendererComponent = defineComponent({
  name: "NumberRendererComponent",
  props: {
    className: {
      type: String,
      default: "",
    },
    type: {
      type: String as PropType<"number" | "digit">,
      default: "number",
    },
    formItemProps: {
      type: Object as PropType<Record<string, any>>,
      default: () => ({}),
    },
    formInstance: {
      type: Object as PropType<Record<string, any> | null>,
      default: null,
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
    value: {
      type: [String, Number] as PropType<string | number>,
      default: "",
    },
    onChange: {
      type: Function as PropType<(value: string) => void>,
      default: () => {},
    },
    onBlur: {
      type: Function as PropType<(event: FocusEvent) => void>,
      default: null,
    },
    onFocus: {
      type: Function as PropType<(event: FocusEvent) => void>,
      default: null,
    },
    align: {
      type: String as PropType<"left" | "center" | "right">,
      default: "right",
    },
    clearable: {
      type: Boolean,
      default: false,
    },
    min: {
      type: Number,
      default: undefined,
    },
    max: {
      type: Number,
      default: undefined,
    },
    error: {
      type: Array as PropType<string[]>,
      default: undefined,
    },
  },
  setup(props, { attrs, slots, expose }: SetupContext) {
    const inputRef = ref<InstanceType<typeof InputRenderer> | null>(null)

    const readonly = computed(() => props.readonly || props.formItemProps?.readonly)
    const disabled = computed(() => props.disabled || props.formItemProps?.disabled)

    // 处理值变化，转换为数字
    const handleChange = (value: string): void => {
      if (value === "" || value === null || value === undefined) {
        props.onChange?.("")

        return
      }

      // 保持字符串形式，让 InputRenderer 处理格式化
      props.onChange?.(value)
    }

    // 暴露方法
    expose({
      focus: () => (inputRef.value as any)?.focus?.(),
      blur: () => (inputRef.value as any)?.blur?.(),
    })

    return () => (
      <div
        class={classNames(
          "schema-form-renderer",
          "schema-form-number-renderer",
          props.className,
          {
            "schema-form-renderer-readonly": readonly.value,
            "schema-form-renderer-disabled": disabled.value,
          }
        )}
      >
        <InputRenderer
          ref={inputRef}
          type={props.type}
          value={props.value?.toString() || ""}
          onChange={handleChange}
          onBlur={props.onBlur}
          onFocus={props.onFocus}
          placeholder={props.placeholder}
          readonlyPlaceholder={props.readonlyPlaceholder}
          readonly={readonly.value}
          disabled={disabled.value}
          align={props.align}
          formItemProps={props.formItemProps}
          min={props.min ?? (attrs as Record<string, any>).min}
          max={props.max ?? (attrs as Record<string, any>).max}
          maxlength={(attrs as Record<string, any>).maxlength}
          clearable={props.clearable}
          v-slots={{
            "left-icon": slots["left-icon"],
            "right-icon": slots["right-icon"],
            button: slots.button,
            extra: slots.extra,
          }}
        />
      </div>
    )
  },
})

/**
 * NumberRenderer - 使用 createRenderWrapper 工厂函数创建的数字渲染器
 *
 * 通过 createRenderWrapper 包装 NumberRendererComponent，提供：
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
export { NumberRendererComponent }

// 默认导出原始组件以保持向后兼容性
export default NumberRendererComponent

// 导出包装后的渲染器（用于 RendererRegistry 注册）
export const NumberRendererWrapped = createRenderWrapper({
  component: NumberRendererComponent,
  defaultProps: {
    clearable: false,
    align: "right",
  },
})
