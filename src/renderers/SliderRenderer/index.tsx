import { computed, defineComponent, PropType, SetupContext } from "vue"

import { Slider } from "vant"

import classNames from "classnames"

import { createRenderWrapper } from "../../renderer/rendererWrapper"
import "./index.scss"

export interface SliderRendererProps {
  value?: number | number[]
  min?: number
  max?: number
  step?: number
  range?: boolean
  className?: string
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  onChange?: (value: number | number[]) => void
  readonly?: boolean
  readonlyPlaceholder?: string
  disabled?: boolean
  button?: boolean
  error?: string[]
}

/**
 * 滑块渲染器组件
 * 使用 Vant Slider 实现滑块功能
 *
 * - Requirement 13.3: THE migrated renderers SHALL support the new state merging logic
 * - Requirement 13.4: THE migrated renderers SHALL support the new slot merging logic
 * - Requirement 13.5: THE migrated renderers SHALL maintain backward compatibility with existing componentProps
 */
const SliderRendererComponent = defineComponent({
  name: "SliderRendererComponent",
  props: {
    value: {
      type: [Number, Array] as PropType<number | number[]>,
      default: 0,
    },
    min: {
      type: Number,
      default: 0,
    },
    max: {
      type: Number,
      default: 100,
    },
    step: {
      type: Number,
      default: 1,
    },
    range: {
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
      type: Function as PropType<(value: number | number[]) => void>,
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
    button: {
      type: Boolean,
      default: true,
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

    // 处理值变化事件
    const handleChange = (value: number | number[]): void => {
      if (finalDisabled.value || finalReadonly.value) return
      props.onChange?.(value)
    }

    // 格式化显示值
    const formatDisplayValue = (value: number | number[] | null | undefined): string => {
      if (value === null || value === undefined) {
        return props.readonlyPlaceholder
      }

      if (Array.isArray(value)) {
        return value.join(" - ")
      }

      return String(value)
    }

    // 渲染只读状态
    const renderReadonly = () => {
      return (
        <div class="schema-form-slider-renderer__readonly">
          <span class="schema-form-slider-renderer__readonly-value">
            {formatDisplayValue(props.value)}
          </span>
        </div>
      )
    }

    return () => {
      if (finalReadonly.value) {
        return (
          <div
            class={classNames(
              "schema-form-slider-renderer",
              "schema-form-slider-renderer--readonly",
              props.className
            )}
          >
            {renderReadonly()}
          </div>
        )
      }

      return (
        <div
          class={classNames("schema-form-slider-renderer", props.className, {
            "schema-form-slider-renderer--disabled": finalDisabled.value,
          })}
        >
          <Slider
            modelValue={props.value as number | [number, number]}
            min={props.min}
            max={props.max}
            step={props.step}
            range={props.range}
            disabled={finalDisabled.value}
            onUpdate:modelValue={handleChange}
            {...attrs}
          />
        </div>
      )
    }
  },
})

/**
 * SliderRenderer - 使用 createRenderWrapper 工厂函数创建的滑块渲染器
 *
 * 通过 createRenderWrapper 包装 SliderRendererComponent，提供：
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
export { SliderRendererComponent }

// 默认导出原始组件以保持向后兼容性
export default SliderRendererComponent

// 导出包装后的渲染器（用于 RendererRegistry 注册）
export const SliderRendererWrapped = createRenderWrapper({
  component: SliderRendererComponent,
})
