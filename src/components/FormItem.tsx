/**
 * FormItem
 *
 * SchemaForm、FormGroup、FormDependency 实际渲染的组件。
 * 负责: isDependencyColumn 守卫、useField()、useRendererContext()、useFormContext()、
 * resolveDynamicProp()、slot 系统 (#nameItem, #name)、renderer h() 调用。
 * 处理列配置后将解析的数据传递给 FormItem 进行渲染。
 *
 * @module components/FormItem
 */

import { computed, defineComponent, h, PropType, ref, watchEffect } from "vue"

import classnames from "classnames"
import { omit } from "es-toolkit"
import z from "zod"

import { useWatchFields } from "../hooks"

import { useField } from "../hooks/useField"
import { useFormContext } from "../hooks/useFormContext"
import { useRendererContext } from "../hooks/useRenderer"
import {
  isDependencyColumn,
  isGroupColumn,
  isNestedColumn,
  resolveDynamicProp,
  resolveDynamicPropByBoolean,
  shouldValidateOn,
} from "../utils"

import FormDependency from "./FormDependency"
import FormGroup from "./FormGroup"
import FormNested from "./FormNested"

import type {
  FormItemProps,
  ProcessedFormItemProps,
  SchemaBaseColumn,
  SchemaColumn,
} from "../types"

const FormItem = defineComponent({
  name: "SchemaFormColumnRenderer",

  props: {
    column: {
      type: Object as PropType<SchemaColumn>,
      required: true,
    },
  },

  setup(props, { slots }) {
    if (isDependencyColumn(props.column)) {
      const depColumn = props.column

      return () => (
        <FormDependency to={depColumn.to} renderer={depColumn.renderer} v-slots={slots} />
      )
    }

    if (isGroupColumn(props.column)) {
      const groupColumn = props.column

      return () => (
        <FormGroup
          columns={groupColumn.columns}
          collapsible={groupColumn.collapsible}
          defaultCollapsed={groupColumn.defaultCollapsed}
          v-slots={slots}
        />
      )
    }

    if (isNestedColumn(props.column)) {
      const nestedColumn = props.column

      return () => <FormNested columns={nestedColumn.columns} v-slots={slots} />
    }

    const rendererRegistry = useRendererContext()
    const formContext = useFormContext()
    const baseColumn = props.column as SchemaBaseColumn
    const field = useField(baseColumn.name)
    const dependencies = Array.isArray(baseColumn.dependencies)
      ? baseColumn.dependencies
      : [baseColumn.dependencies]

    const resolvedReadonly = ref(false)
    const resolvedDisabled = ref(false)
    const resolvedHidden = ref(false)
    const resolvedRequired = ref(false)
    const resolvedPlaceholder = ref("")

    const resolvedComponentProps = ref<any>({})

    // 稳定的 onChange 引用，避免每次渲染创建新函数导致子组件无限更新
    const trigger = baseColumn.validationTrigger ?? formContext.validationTrigger

    const formItemProps = computed<Omit<ProcessedFormItemProps, "componentProps">>(() => {
      return {
        ...omit<FormItemProps>(baseColumn, ["componentProps"]),
        name: baseColumn.name,
        componentType: baseColumn.componentType,
        class: classnames("schema-form-item", baseColumn.className),
        required: resolvedRequired.value,
        readonly: resolvedReadonly.value,
        disabled: resolvedDisabled.value,
        hidden: resolvedHidden.value,
      }
    })

    const processedComponentProps = computed(() => {
      return {
        ...resolvedComponentProps.value,
        required: resolvedRequired.value,
        readonly: resolvedReadonly.value,
        disabled: resolvedDisabled.value,
        hidden: resolvedHidden.value,
        value: field.getValue(),
        onChange: handleChange,
        onBlur: handleBlur,
        formItemProps: formItemProps.value,
      }
    })

    // 解析所有的动态属性
    useWatchFields(
      dependencies,
      (payload, prevSnapshot, latestSnapshot) => {
        resolveDynamicProp(
          baseColumn.placeholder,
          latestSnapshot,
          `${baseColumn.label}为必填项`
        ).then((data) => {
          resolvedPlaceholder.value = data
        })

        resolveDynamicProp(baseColumn.componentProps, latestSnapshot, {}).then((data) => {
          resolvedComponentProps.value = data
        })

        resolveDynamicPropByBoolean(
          baseColumn.readonly,
          latestSnapshot,
          formContext.readonly
        ).then((data) => {
          resolvedReadonly.value = data
        })

        resolveDynamicPropByBoolean(
          baseColumn.disabled,
          latestSnapshot,
          formContext.disabled
        ).then((data) => {
          resolvedDisabled.value = data
        })

        resolveDynamicPropByBoolean(baseColumn.hidden, latestSnapshot, false).then(
          (data) => {
            resolvedHidden.value = data
          }
        )

        resolveDynamicPropByBoolean(baseColumn.required, latestSnapshot, false).then(
          (data) => {
            resolvedRequired.value = data
          }
        )
      },
      {
        immediate: true,
      }
    )

    // 设置默认的必填rule
    watchEffect(() => {
      if (resolvedHidden.value) {
        field.clearError()
        field.unregisterRules()
      } else {
        let rules = baseColumn?.rules

        if (baseColumn?.required || baseColumn?.rules === "required") {
          const placeholder = resolvedComponentProps.value?.placeholder
            ? resolvedComponentProps.value?.placeholder
            : resolvedPlaceholder.value

          rules = z
            .string({ message: placeholder as string })
            .min(1, { message: placeholder as string })
        } else {
          rules = baseColumn?.rules
        }

        if (rules) field.registerRules(rules)
      }
    })

    /** 值变化处理，设置值后根据触发时机决定是否校验 */
    const handleChange = (v: unknown) => {
      field.setValue(v)
      if (shouldValidateOn("change", trigger)) {
        field.validate()
      }
    }

    /** 失焦处理，根据触发时机决定是否校验 */
    const handleBlur = () => {
      if (shouldValidateOn("blur", trigger)) {
        field.validate()
      }
    }

    return () => {
      if (resolvedHidden.value) {
        return null
      }

      const slotName = String(formItemProps.value.name)

      // 自定义 item slot (#nameItem) — 替换整个表单项
      if (slots[`${slotName}Item`]) {
        return slots[`${slotName}Item`]?.(formItemProps.value)
      }

      // 确定内容元素: #name slot 或 renderer
      let columnElement = null

      if (slots[slotName]) {
        columnElement = slots[slotName]?.(formItemProps.value)
      } else {
        const component = rendererRegistry.getRenderer(formItemProps.value.componentType)

        if (!component) {
          throw new Error(
            `[SchemaForm] Can not find component renderer of "${formItemProps.value.componentType}".`
          )
        }

        columnElement = h(component, processedComponentProps.value, slots)
      }

      if (!columnElement) return null

      const labelAlign = baseColumn.labelAlign ?? formContext.labelAlign
      const labelWidth = baseColumn.labelWidth ?? formContext.labelWidth
      const colon = baseColumn.colon ?? formContext.colon
      const labelAlignClass = `schema-form-item--label-${labelAlign}`

      return (
        <div class="schema-form-item-wrapper">
          <div
            class={classnames("schema-form-item", baseColumn.className, labelAlignClass)}
          >
            {formItemProps.value.label && (
              <label
                class="schema-form-item__label"
                style={labelWidth ? { width: labelWidth } : undefined}
              >
                {resolvedRequired.value && (
                  <span class="schema-form-item__required">*</span>
                )}

                <span class="schema-form-item__label-text">
                  {formItemProps.value.label}
                  {colon ? ":" : ""}
                </span>
              </label>
            )}
            <div class="schema-form-item__content">
              <div class="schema-form-item__control">{columnElement}</div>

              {field.error.value && field.error.value.length > 0 && (
                <div class="schema-form-item__error">{field.error.value[0]}</div>
              )}
            </div>
          </div>
        </div>
      )
    }
  },
})

export default FormItem
