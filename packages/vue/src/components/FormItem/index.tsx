/**
 * FormItem
 *
 * schemx、FormGroup、FormDependency 实际渲染的组件。
 * 负责: isDependencySchema 守卫、useField()、useFormInstance()、useFormContext()、
 * resolveDynamicProp()、slot 系统 (#nameItem, #name)、renderer h() 调用。
 * 处理列配置后将解析的数据传递给 FormItem 进行渲染。
 *
 * @module components/FormItem
 */

import { computed, defineComponent, h, onMounted, PropType, toRef } from "vue"
import type { SetupContext, VNodeChild } from "vue"

import { isGroupSchema } from "@schemx/core"
import classnames from "classnames"
import { omit } from "es-toolkit"

import { useContext } from "@/hooks/useContext"
import { useDependencies } from "@/hooks/useDependencies"
import { useFieldHandler } from "@/hooks/useFieldHandler"
import { useFormInstance } from "@/hooks/useForm"
import { useStableRef } from "@/hooks/useStableRef"
import { extractChildSlots, resolveSlot } from "@/utils"

import FormGroup from "../FormGroup"

import type {
  SchemxBaseField,
  SchemxComponentProps,
  SchemxFormItemProps,
  SchemxResolvedGroupField,
  SchemxResolvedField,
  Values,
} from "@schemx/core"

/**
 * FormItem Props
 *
 * @typeParam T - 表单值类型
 */
export interface SchemxItemProps<T extends Values = Values> {
  schema: SchemxResolvedField<T>
}

const FormItem = defineComponent(
  <T extends Values = Values>(props: SchemxItemProps<T>, { slots }: SetupContext) => {
    const schemaRef = toRef(props, "schema")

    if (isGroupSchema(schemaRef.value)) {
      return () => {
        const schema = schemaRef.value

        if (!isGroupSchema(schema)) {
          return null
        }

        return <FormGroup schema={schema as SchemxResolvedGroupField} v-slots={slots} />
      }
    }

    const getSchema = (): SchemxBaseField<T> => schemaRef.value as SchemxBaseField<T>
    const schema = getSchema()
    const form = useFormInstance<T>()
    const formContext = useContext()

    const { getRenderer } = form.getInternalHooks()

    const resolvedProps = useDependencies<T>(form, schema.dependencies, {
      visible: schema.visible ?? true,
      readonly: schema.readonly ?? formContext.readonly ?? false,
      disabled: schema.disabled ?? formContext.disabled ?? false,
      required: schema.required ?? !!schema.rules,
      placeholder: schema.placeholder ?? `${schema.label}为必填项`,
      componentProps: (schema.componentProps ?? {}) as SchemxComponentProps<T>,
      rules: schema.rules,
    })

    const { field, trigger, handleChange, handleBlur } = useFieldHandler<T>(
      schema,
      resolvedProps
    )

    /**
     * schemas 每一项的 props
     */
    const formItemProps = computed<SchemxFormItemProps<T>>((): SchemxFormItemProps<T> => {
      const schema = getSchema()

      return {
        ...(omit(schema, ["componentProps"]) satisfies SchemxFormItemProps<T>),
        name: schema.name,
        componentType: schema.componentType,
        class: classnames("schemx-item", schema.class),
        required: resolvedProps.required,
        readonly: resolvedProps.readonly,
        disabled: resolvedProps.disabled,
        visible: resolvedProps.visible,
        placeholder: resolvedProps.placeholder,
        validationTrigger: trigger,
      }
    })

    // 使用 useStableRef 避免每次生成新对象引用
    const componentProps = useStableRef<SchemxComponentProps<T>>(
      (): SchemxComponentProps<T> => ({
        ...resolvedProps.componentProps,
        visible: resolvedProps.visible,
        required: resolvedProps.required,
        readonly: resolvedProps.readonly,
        disabled: resolvedProps.disabled,
        placeholder: resolvedProps.placeholder,
        value: field.getValue(),
        onChange: handleChange,
        onBlur: handleBlur,
        formItemProps: formItemProps.value,
      })
    )

    onMounted(() => {
      const schema = getSchema()
      const value = Object.hasOwn(schema, "initialValue")
        ? schema.initialValue
        : undefined

      field.setInitialValue(value)
    })

    /**
     * 渲染 required 星号。
     *
     * 当字段为必填且非禁用/只读状态时，在 label 前显示红色星号标记。
     *
     * @returns 星号 VNode 或空片段
     */
    const renderRequired = (): VNodeChild => {
      if (!resolvedProps.required || resolvedProps.disabled || resolvedProps.readonly) {
        return null
      }

      return <span class="schemx-item__required">*</span>
    }

    /**
     * 渲染 formItem label 区域。
     *
     * 优先使用 `{name}Label` 插槽（支持 camelCase / kebab-case），
     * 未提供时渲染默认 label（含 required 星号、label 文本、冒号）。
     *
     * @returns label VNode
     */
    const renderLabel = (): VNodeChild => {
      const schema = getSchema()
      const labelSlot = resolveSlot(slots, `${schema.name}Label`)

      if (labelSlot) {
        return labelSlot(formItemProps.value)
      }

      const labelAlign = schema.labelAlign || formContext.labelAlign
      const labelWidth = schema.labelWidth || formContext.labelWidth
      const colon = schema.colon ?? formContext.colon

      return (
        <label
          class="schemx-item__label"
          style={{ width: labelWidth, textAlign: labelAlign }}
        >
          {renderRequired()}
          <span class="schemx-item__label-text">
            {schema.label}
            {colon ? ":" : ""}
          </span>
        </label>
      )
    }

    /**
     * 渲染 formItem content 区域（仅控件）。
     *
     * 优先使用 `{name}Content` 插槽（支持 camelCase / kebab-case），
     * 插槽参数包含 formItemProps 和 columnElement（渲染器 VNode）。
     * 未提供插槽时，渲染默认控件布局。
     *
     * @returns content VNode
     */
    const renderContent = (): VNodeChild => {
      const schema = getSchema()
      const component = getRenderer(schema.componentType)

      if (!component) {
        throw new Error(
          `[schemx] Can not find component renderer of "${schema.componentType}".`
        )
      }

      // 提取子渲染器插槽（fieldName:slotName 格式）
      const childSlots = extractChildSlots(schema.name, slots)
      const columnElement = h(component, componentProps.value, childSlots)

      const contentSlot = resolveSlot(slots, `${schema.name}Content`)

      if (contentSlot) {
        return contentSlot({
          ...formItemProps.value,
          columnElement,
        })
      }

      return <div class="schemx-item__control">{columnElement}</div>
    }

    /**
     * 渲染 formItem error 区域。
     *
     * 优先使用 `{name}Error` 插槽（支持 camelCase / kebab-case），
     * 插槽参数包含 formItemProps 和 errors 数组。
     * 未提供插槽时，仅在存在错误时显示第一条错误信息。
     *
     * @returns error VNode 或 null
     */
    const renderError = (): VNodeChild => {
      const schema = getSchema()
      const errorSlot = resolveSlot(slots, `${schema.name}Error`)

      if (errorSlot) {
        return errorSlot({
          ...formItemProps.value,
          errors: field.error.value,
        })
      }

      if (!Array.isArray(field.error.value) || field.error.value.length === 0) {
        return null
      }

      return <div class="schemx-item__error">{field.error.value[0]}</div>
    }

    return (): VNodeChild => {
      const schema = getSchema()

      if (!resolvedProps.visible) {
        return null
      }

      // 整体插槽：完全接管渲染，不包裹任何默认结构
      const itemSlot = resolveSlot(slots, schema.name)

      if (itemSlot) {
        return itemSlot(formItemProps.value)
      }

      const labelPosition = schema.labelPosition || formContext.labelPosition

      return (
        <div
          class={classnames("schemx-item-wrapper", {
            "is-readonly": resolvedProps.readonly,
            "is-disabled": resolvedProps.disabled,
          })}
        >
          <div
            class={classnames(
              "schemx-item",
              `schemx-item--label-${labelPosition}`,
              schema.class
            )}
            style={{ ...(schema.style ?? {}) }}
          >
            {renderLabel()}

            <div class="schemx-item__content">
              {renderContent()}
              {renderError()}
            </div>
          </div>
        </div>
      )
    }
  },
  {
    name: "SchemxItem",

    props: {
      schema: {
        type: Object as PropType<SchemxResolvedField>,
        required: true,
      },
    },
  }
)

export default FormItem
