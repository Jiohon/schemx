import { computed, defineComponent, PropType, SetupContext } from "vue"

import { Icon } from "vant"

import classNames from "classnames"

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
  setup(props, { attrs: _ }: SetupContext) {
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
          <span class="schemx-rate-renderer__readonly-placeholder">
            {props.readonlyPlaceholder}
          </span>
        )
      }

      return (
        <div class="schemx-rate-renderer__readonly">
          {Array.from({ length: props.count }, (_, index) => (
            <Icon
              key={index}
              name={index < props.value ? "star" : "star-o"}
              class={classNames(
                "schemx-rate-renderer__star",
                "schemx-rate-renderer__star--readonly",
                index < props.value && "schemx-rate-renderer__star--active"
              )}
            />
          ))}
          <span class="schemx-rate-renderer__readonly-text">({props.value})</span>
        </div>
      )
    }

    return () => {
      if (finalReadonly.value) {
        return (
          <div
            class={classNames(
              "schemx-rate-renderer",
              "schemx-rate-renderer--readonly",
              props.className
            )}
          >
            {renderReadonly()}
          </div>
        )
      }

      return (
        <div
          class={classNames("schemx-rate-renderer", props.className, {
            "schemx-rate-renderer--disabled": finalDisabled.value,
          })}
        >
          <div class="schemx-rate-renderer__stars">
            {Array.from({ length: props.count }, (_, index) => (
              <Icon
                key={index}
                name={index < props.value ? "star" : "star-o"}
                class={classNames(
                  "schemx-rate-renderer__star",
                  index < props.value && "schemx-rate-renderer__star--active",
                  finalDisabled.value && "schemx-rate-renderer__star--disabled"
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

export default RateRendererComponent
