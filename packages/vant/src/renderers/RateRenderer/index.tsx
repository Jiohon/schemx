import { computed, defineComponent, PropType, SetupContext } from "vue"

import { Rate } from "vant"

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
 *
 * 基于 Vant Rate 组件实现评分功能。
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
    const finalReadonly = computed(() => props.readonly || props.formItemProps?.readonly)
    const finalDisabled = computed(() => props.disabled || props.formItemProps?.disabled)

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
            {props.value ? (
              <Rate
                modelValue={props.value}
                count={props.count}
                allowHalf={props.allowHalf}
                readonly
              />
            ) : (
              <span class="schemx-rate-renderer__readonly-placeholder">
                {props.readonlyPlaceholder}
              </span>
            )}
          </div>
        )
      }

      return (
        <div
          class={classNames("schemx-rate-renderer", props.className, {
            "schemx-rate-renderer--disabled": finalDisabled.value,
          })}
        >
          <Rate
            {...attrs}
            modelValue={props.value}
            count={props.count}
            allowHalf={props.allowHalf}
            disabled={finalDisabled.value}
            onUpdate:modelValue={props.onChange}
          />
        </div>
      )
    }
  },
})

export default RateRendererComponent
