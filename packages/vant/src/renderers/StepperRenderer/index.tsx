import { computed, defineComponent, PropType, SetupContext } from "vue"

import { Stepper } from "vant"

import classNames from "classnames"

import "./index.scss"

export interface StepperRendererProps {
  value?: number
  min?: number
  max?: number
  step?: number
  integer?: boolean
  decimalLength?: number
  className?: string
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  onChange?: (value: number) => void
  readonly?: boolean
  readonlyPlaceholder?: string
  disabled?: boolean
  allowEmpty?: boolean
  error?: string[]
}

/**
 * 步进器渲染器组件
 * 使用 Vant Stepper 实现数值调节功能
 *
 */
const StepperRendererComponent = defineComponent({
  name: "StepperRendererComponent",
  props: {
    value: { type: Number, default: 0 },
    min: { type: Number, default: undefined },
    max: { type: Number, default: undefined },
    step: { type: Number, default: 1 },
    integer: { type: Boolean, default: false },
    decimalLength: { type: Number, default: undefined },
    className: { type: String, default: "" },
    formItemProps: { type: Object as PropType<Record<string, any>>, default: () => ({}) },
    formInstance: { type: Object as PropType<Record<string, any> | null>, default: null },
    onChange: { type: Function as PropType<(value: number) => void>, default: () => {} },
    readonly: { type: Boolean, default: false },
    readonlyPlaceholder: { type: String, default: "-" },
    disabled: { type: Boolean, default: false },
    allowEmpty: { type: Boolean, default: false },
    error: { type: Array as PropType<string[]>, default: undefined },
  },
  setup(props, { attrs }: SetupContext) {
    const fieldProps = computed(() => ({
      readonly: props.readonly || props.formItemProps?.readonly,
      disabled: props.disabled || props.formItemProps?.disabled,
    }))

    const finalReadonly = computed(() => fieldProps.value.readonly)
    const finalDisabled = computed(() => fieldProps.value.disabled)

    const handleChange = (value: number): void => {
      if (finalDisabled.value || finalReadonly.value) return
      props.onChange?.(value)
    }

    const formatDisplayValue = (value: number | null | undefined): string => {
      if (
        value === null ||
        value === undefined ||
        (value === ("" as any) && !props.allowEmpty)
      ) {
        return props.readonlyPlaceholder
      }

      return String(value)
    }

    const renderReadonly = () => (
      <div class="schema-form-stepper-renderer__readonly">
        <span class="schema-form-stepper-renderer__readonly-value">
          {formatDisplayValue(props.value)}
        </span>
      </div>
    )

    return () => {
      if (finalReadonly.value) {
        return (
          <div
            class={classNames(
              "schema-form-stepper-renderer",
              "schema-form-stepper-renderer--readonly",
              props.className
            )}
          >
            {renderReadonly()}
          </div>
        )
      }

      return (
        <div
          class={classNames("schema-form-stepper-renderer", props.className, {
            "schema-form-stepper-renderer--disabled": finalDisabled.value,
          })}
        >
          <Stepper
            modelValue={props.value}
            min={props.min}
            max={props.max}
            step={props.step}
            integer={props.integer}
            decimalLength={props.decimalLength}
            disabled={finalDisabled.value}
            allowEmpty={props.allowEmpty}
            onUpdate:modelValue={handleChange}
            {...attrs}
          />
        </div>
      )
    }
  },
})

export default StepperRendererComponent
