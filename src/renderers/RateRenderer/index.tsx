import { computed, defineComponent, PropType, SetupContext } from "vue"

import { Icon } from "vant"

import classNames from "classnames"

import { createRenderWrapper } from "../../renderer/rendererWrapper"
import "./index.scss"

export interface RateRendererProps {
  value?: number
  count?: number
  allowHalf?: boolean
  className?: string
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  onChange?: (value: number) => void
  readonly?: boolean
  readonlyPlaceholder?: string
  disabled?: boolean
  error?: string[]
}

/**
 * 评分渲染器组件
 * 使用 Vant Icon 实现评分功能
 *
 * - Requirement 13.3: THE migrated renderers SHALL support the new state merging logic
 * - Requirement 13.4: THE migrated renderers SHALL support the new slot merging logic
 * - Requirement 13.5: THE migrated renderers SHALL maintain backward compatibility with existing componentProps
 */
const RateRendererComponent = defineComponent({
  name: "RateRendererComponent",
  props: {
    value: {
      type: Number,
      default: 0,
    },
    count: {
      type: Number,
      default: 5,
    },
    allowHalf: {
      type: Boolean,
      default: false,
    },
    className: {
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
      type: Function as PropType<(value: number) => void>,
      default: () => {},
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
  setup(props, { attrs }: SetupContext) {
    const fieldProps = computed(() => ({
      readonly: props.readonly || props.formItemProps?.readonly,
      disabled: props.disabled || props.formItemProps?.disabled,
    }))

    // 计算最终的只读和禁用状态
    const finalReadonly = computed(() => fieldProps.value.readonly)
    const finalDisabled = computed(() => fieldProps.value.disabled)

    // 处理点击事件
    const handleStarClick = (index: number): void => {
      if (finalDisabled.value || finalReadonly.value) return

      const newValue = index + 1
      props.onChange?.(newValue)
    }

    // 渲染只读状态
    const renderReadonly = () => {
      if (!props.value) {
        return (
          <span class="schema-form-rate-renderer__readonly-placeholder">
            {props.readonlyPlaceholder}
          </span>
        )
      }

      return (
        <div class="schema-form-rate-renderer__readonly">
          {Array.from({ length: props.count }, (_, index) => (
            <Icon
              key={index}
              name={index < props.value ? "star" : "star-o"}
              class={classNames(
                "schema-form-rate-renderer__star",
                "schema-form-rate-renderer__star--readonly",
                index < props.value && "schema-form-rate-renderer__star--active"
              )}
            />
          ))}
          <span class="schema-form-rate-renderer__readonly-text">({props.value})</span>
        </div>
      )
    }

    return () => {
      if (finalReadonly.value) {
        return (
          <div
            class={classNames(
              "schema-form-rate-renderer",
              "schema-form-rate-renderer--readonly",
              props.className
            )}
          >
            {renderReadonly()}
          </div>
        )
      }

      return (
        <div
          class={classNames("schema-form-rate-renderer", props.className, {
            "schema-form-rate-renderer--disabled": finalDisabled.value,
          })}
        >
          <div class="schema-form-rate-renderer__stars">
            {Array.from({ length: props.count }, (_, index) => (
              <Icon
                key={index}
                name={index < props.value ? "star" : "star-o"}
                class={classNames(
                  "schema-form-rate-renderer__star",
                  index < props.value && "schema-form-rate-renderer__star--active",
                  finalDisabled.value && "schema-form-rate-renderer__star--disabled"
                )}
                onClick={() => handleStarClick(index)}
              />
            ))}
          </div>
        </div>
      )
    }
  },
})

/**
 * RateRenderer - 使用 createRenderWrapper 工厂函数创建的评分渲染器
 *
 * 通过 createRenderWrapper 包装 RateRendererComponent，提供：
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
export { RateRendererComponent }

// 默认导出原始组件以保持向后兼容性
export default RateRendererComponent

// 导出包装后的渲染器（用于 RendererRegistry 注册）
export const RateRendererWrapped = createRenderWrapper({
  component: RateRendererComponent,
})
