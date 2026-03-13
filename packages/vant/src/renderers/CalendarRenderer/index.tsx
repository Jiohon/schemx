import { computed, defineComponent, PropType, ref, SetupContext } from "vue"

import { Calendar, Field } from "vant"

import classNames from "classnames"
import dayjs from "dayjs"

import { getFieldProps } from "@/utils"
import "./index.scss"

export interface CalendarRendererProps {
  value?: string | string[] | Date
  onConfirm?: (value: string | string[]) => void
  className?: string
  popupClassName?: string
  onChange?: (value: string | string[]) => void
  readonly?: boolean
  readonlyPlaceholder?: string
  disabled?: boolean
  type?: "single" | "range" | "multiple"
  format?: string
  separator?: string
  formItemProps?: Record<string, any>
  formInstance?: Record<string, any> | null
  error?: string[]
}

/**
 * 日历选择器渲染器组件
 * 使用 Vant Calendar + Popup + Field 组合实现
 *
 */
const CalendarRendererComponent = defineComponent({
  name: "CalendarRendererComponent",
  props: {
    value: {
      type: [String, Array, Date] as PropType<string | string[] | Date>,
      default: "",
    },
    onConfirm: {
      type: Function as PropType<(value: string | string[]) => void>,
      default: () => {},
    },
    className: {
      type: String,
      default: "",
    },
    popupClassName: {
      type: String,
      default: "",
    },
    onChange: {
      type: Function as PropType<(value: string | string[]) => void>,
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
    type: {
      type: String as PropType<"single" | "range" | "multiple">,
      default: "single",
    },
    format: {
      type: String,
      default: "YYYY-MM-DD",
    },
    separator: {
      type: String,
      default: " - ",
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

  setup(props, { attrs, slots }: SetupContext) {
    const showCalendar = ref(false)

    const placeholder = computed(
      () =>
        (attrs as Record<string, any>)?.placeholder ||
        `请选择${props.formItemProps.label}`
    )

    const readonly = computed(
      () => (attrs as Record<string, any>)?.readonly || props.formItemProps?.readonly
    )
    const disabled = computed(
      () => (attrs as Record<string, any>)?.disabled || props.formItemProps?.disabled
    )

    const modelValue = computed(() => {
      const value = getValue(props.value)

      return Array.isArray(value) ? value.join(props.separator) : value
    })

    const title = computed(() => {
      return (attrs as Record<string, any>)?.title || placeholder.value
    })

    // 获取值的函数，支持String, Array, Date三种类型
    const getValue = (
      value: string | string[] | Date | null | undefined
    ): string | string[] => {
      if (!value) return ""

      if (Array.isArray(value)) {
        return value.map((i) => dayjs(i).format(props.format))
      } else {
        return dayjs(value).format(props.format)
      }
    }

    const handleConfirm = (date: Date | Date[]): void => {
      if (readonly.value || disabled.value) return

      const value = getValue(date as any)

      props.onConfirm?.(value)
      props.onChange?.(value)
      showCalendar.value = false
    }

    const handleClick = (): void => {
      if (readonly.value || disabled.value) return
      showCalendar.value = true
    }

    return () => (
      <div
        class={classNames(
          "schema-form-renderer",
          "schema-form-calendar-renderer",
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
          modelValue={modelValue.value}
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
          <Calendar
            v-model:show={showCalendar.value}
            type={props.type}
            onConfirm={handleConfirm}
            showConfirm
            minDate={new Date(1970, 0, 1)}
            maxDate={dayjs().add(10, "year").toDate()}
            {...attrs}
            title={title.value}
          />
        )}
      </div>
    )
  },
})

export default CalendarRendererComponent
