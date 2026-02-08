/**
 * FormItem - 表单项组件
 *
 * @module FormItem
 */

import { computed, defineComponent, h, PropType } from "vue"

import { Field } from "vant"

import classnames from "classnames"
import { omit } from "lodash-es"

import { FormDependency } from "./components"
import { useField } from "./hooks/useField"
import { useRendererContext } from "./hooks/useRenderer"
import { getFieldType, resolveDynamicProp } from "./utils"

import type {
  BaseColumnConfig,
  ColumnConfig,
  DependencyColumnConfig,
  ProcessedBaseColumnConfig,
} from "./types"

// ==================== 类型守卫 ====================
function isDependencyColumn(column: ColumnConfig): column is DependencyColumnConfig {
  return column.componentType === "dependency"
}

// ==================== 常量 ====================

const IGNORE_FIELD_PROPS = [
  "autofocus",
  "show-word-limit",
  "showWordLimit",
  "autocomplete",
  "autocapitalize",
  "enterkeyhint",
  "spellcheck",
  "autocorrect",
  "inputmode",
  "model-value",
  "modelValue",
  "placeholder",
  "maxlength",
  "min",
  "max",
]

// ==================== 组件定义 ====================

const FormItem = defineComponent({
  name: "SchemaFormItem",

  props: {
    column: {
      type: Object as PropType<ColumnConfig>,
      required: true,
    },
  },

  setup(props, { slots }) {
    // ==================== 依赖字段直接渲染 ====================

    if (isDependencyColumn(props.column)) {
      const depColumn = props.column

      return () => (
        <FormDependency to={depColumn.to} renderer={depColumn.renderer} v-slots={slots} />
      )
    }

    const rendererRegistry = useRendererContext()

    const baseColumn = props.column as BaseColumnConfig

    // ==================== 使用 useField Hook ====================

    const field = useField(baseColumn.name)

    // 稳定的 onChange 引用，避免每次渲染创建新函数导致子组件无限更新
    const handleChange = (v: unknown) => field.setValue(v)

    // ==================== 响应式计算（setup 阶段，有缓存） ====================

    const values = computed(() => field.getValues())

    const resolvedRequired = computed(() =>
      resolveDynamicProp(baseColumn.required || null, values.value, false)
    )

    const resolvedReadonly = computed(() =>
      resolveDynamicProp(baseColumn.readonly || null, values.value, false)
    )

    const resolvedDisabled = computed(() =>
      resolveDynamicProp(baseColumn.disabled || null, values.value, false)
    )

    const resolvedHidden = computed(() =>
      resolveDynamicProp(baseColumn.hidden || null, values.value, false)
    )

    // 缓存 processedColumn，只在依赖的响应式值变化时才重新计算
    const processedColumn = computed<ProcessedBaseColumnConfig>(() => {
      return omit(
        {
          ...baseColumn,
          label: baseColumn.label,
          class: classnames("schema-form-item", baseColumn.className),
          required: resolvedRequired.value,
          readonly: resolvedReadonly.value,
          disabled: resolvedDisabled.value,
          hidden: resolvedHidden.value,
        },
        IGNORE_FIELD_PROPS
      ) as ProcessedBaseColumnConfig
    })

    // 缓存传给 Field 的 props，避免每次渲染创建新对象
    const fieldProps = computed(() =>
      omit(processedColumn.value, ["componentType", "componentProps", "rules"])
    )

    const _fieldType = getFieldType(baseColumn)

    // ==================== 渲染 ====================

    return () => {
      // 隐藏字段不渲染
      if (resolvedHidden.value) {
        return null
      }

      const col = processedColumn.value

      // 自定义 item slot (#nameItem)
      if (slots[`${col.name}Item`]) {
        return slots[`${col.name}Item`]?.(col)
      }

      let columnElement = null

      // 自定义 slot (#name) 或使用渲染器
      if (slots[col.name]) {
        columnElement = slots[col.name]?.(col)
      } else {
        const component = rendererRegistry.getRenderer(col.componentType)
        if (!component) return null

        columnElement = h(
          component,
          {
            name: col.name,
            value: field.getValue(),
            onChange: handleChange,
            readonly: resolvedReadonly.value,
            disabled: resolvedDisabled.value,
            formItemProps: col,
          },
          slots
        )
      }

      if (!columnElement) return null

      return (
        <div class="schema-form-item-wrapper">
          <Field
            {...fieldProps.value}
            modelValue={field.getValue()}
            v-slots={{
              input: () => columnElement,
            }}
          />
        </div>
      )
    }
  },
})

export default FormItem
