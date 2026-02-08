import { computed, defineComponent, PropType, ref, SetupContext } from "vue"

import classNames from "classnames"

import { createRenderWrapper } from "../../renderer/rendererWrapper"
import InputRenderer from "../InputRenderer"
import "./index.scss"

export interface TextAreaRendererProps {
  className?: string
  autosize?: boolean | { minRows?: number; maxRows?: number }
  autoSize?: boolean | { minRows?: number; maxRows?: number }
  rows?: number | string
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
  showWordLimit?: boolean
  error?: string[]
}

/**
 * 文本域输入渲染器组件
 * 基于 InputRenderer 实现
 *
 * - Requirement 13.3: THE migrated renderers SHALL support the new state merging logic
 * - Requirement 13.4: THE migrated renderers SHALL support the new slot merging logic
 * - Requirement 13.5: THE migrated renderers SHALL maintain backward compatibility with existing componentProps
 */
const TextAreaRendererComponent = defineComponent({
  name: "TextAreaRendererComponent",
  props: {
    className: {
      type: String,
      default: "",
    },
    autosize: {
      type: [Boolean, Object] as PropType<
        boolean | { minRows?: number; maxRows?: number }
      >,
      default: () => ({ minRows: 2, maxRows: 6 }),
    },
    // 兼容旧的 autoSize 属性名
    autoSize: {
      type: [Boolean, Object] as PropType<
        boolean | { minRows?: number; maxRows?: number }
      >,
      default: undefined,
    },
    rows: {
      type: [Number, String] as PropType<number | string>,
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
    showWordLimit: {
      type: Boolean,
      default: false,
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

    // 兼容 autoSize 和 autosize
    const computedAutosize = computed(() => {
      return props.autoSize ?? props.autosize ?? { minRows: 2, maxRows: 6 }
    })

    // 计算行数
    const computedRows = computed(() => {
      if (props.rows !== undefined) {
        return props.rows
      }

      const autosize = computedAutosize.value

      if (typeof autosize === "object" && autosize.minRows) {
        return autosize.minRows
      }

      return 2
    })

    // 暴露方法
    expose({
      focus: () => (inputRef.value as any)?.focus?.(),
      blur: () => (inputRef.value as any)?.blur?.(),
    })

    return () => (
      <div
        class={classNames(
          "schema-form-renderer",
          "schema-form-textarea-renderer",
          props.className,
          {
            "schema-form-renderer-readonly": readonly.value,
            "schema-form-renderer-disabled": disabled.value,
          }
        )}
      >
        <InputRenderer
          ref={inputRef}
          type="textarea"
          value={props.value}
          onChange={props.onChange}
          onBlur={props.onBlur}
          onFocus={props.onFocus}
          placeholder={props.placeholder}
          readonlyPlaceholder={props.readonlyPlaceholder}
          readonly={readonly.value}
          disabled={disabled.value}
          align={props.align}
          formItemProps={props.formItemProps}
          rows={computedRows.value}
          autosize={computedAutosize.value}
          maxlength={(attrs as Record<string, any>).maxlength}
          showWordLimit={props.showWordLimit && !readonly.value && !disabled.value}
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
 * TextAreaRenderer - 使用 createRenderWrapper 工厂函数创建的文本域渲染器
 *
 * 通过 createRenderWrapper 包装 TextAreaRendererComponent，提供：
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
export { TextAreaRendererComponent }

// 默认导出原始组件以保持向后兼容性
export default TextAreaRendererComponent

// 导出包装后的渲染器（用于 RendererRegistry 注册）
export const TextAreaRendererWrapped = createRenderWrapper({
  component: TextAreaRendererComponent,
  defaultProps: {
    align: "right",
  },
})
