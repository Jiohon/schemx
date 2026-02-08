import { computed, defineComponent, PropType, SetupContext, useSlots } from 'vue'
import './selector.scss'

export interface SelectorOption {
  label?: string
  value?: string | number
  disabled?: boolean
  [key: string]: any
}

export interface SelectorProps {
  modelValue?: string | number | (string | number)[]
  options?: SelectorOption[]
  multiple?: boolean
  fieldNames?: {
    label?: string
    value?: string
    disabled?: string
  }
  disabled?: boolean
}

const Selector = defineComponent({
  name: 'Selector',
  props: {
    modelValue: {
      type: [String, Number, Array] as PropType<string | number | (string | number)[]>,
      default: () => [],
    },
    options: {
      type: Array as PropType<SelectorOption[]>,
      default: () => [],
    },
    multiple: {
      type: Boolean,
      default: false,
    },
    fieldNames: {
      type: Object as PropType<{ label?: string; value?: string; disabled?: string }>,
      default: () => ({ label: 'label', value: 'value', disabled: 'disabled' }),
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }: SetupContext<['update:modelValue', 'change']>) {
    const slots = useSlots()

    const labelKey = computed(() => props.fieldNames?.label || 'label')
    const valueKey = computed(() => props.fieldNames?.value || 'value')
    const disabledKey = computed(() => props.fieldNames?.disabled || 'disabled')

    const selectedValues = computed(() => {
      if (props.multiple) {
        return Array.isArray(props.modelValue) ? props.modelValue : []
      }

      return props.modelValue === undefined || props.modelValue === null
        ? []
        : [props.modelValue]
    })

    const options = computed(() => (Array.isArray(props.options) ? props.options : []))

    const isSelected = (option: SelectorOption): boolean => {
      return selectedValues.value.includes(option?.[valueKey.value] as string | number)
    }

    const handleClick = (option: SelectorOption): void => {
      if (props.disabled || option?.[disabledKey.value]) return

      const value = option?.[valueKey.value]

      if (props.multiple) {
        const next = selectedValues.value.includes(value as string | number)
          ? selectedValues.value.filter((item) => item !== value)
          : [...selectedValues.value, value]

        emit('update:modelValue', next)
        emit('change', next, option)

        return
      }

      emit('update:modelValue', value)
      emit('change', value, option)
    }

    const optionClass = (item: SelectorOption): Record<string, boolean> => ({
      option: true,
      active: isSelected(item),
      disabled: props.disabled || !!item?.[disabledKey.value],
    })

    return () => (
      <div class="selector">
        {options.value.map((item) => (
          <div
            key={item?.[valueKey.value] as string | number}
            class={optionClass(item)}
            onClick={() => handleClick(item)}
          >
            {slots.item ? slots.item({ item }) : item?.[labelKey.value]}
          </div>
        ))}
      </div>
    )
  },
})

export default Selector
