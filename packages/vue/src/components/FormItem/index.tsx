/**
 * FormItem
 *
 * schemx 和 FormGroup 实际渲染字段的组件。
 * 动态属性已由 core runtime 解析到 schema 投影中；这里只负责消费
 * 已解析 schema、创建字段实例、组装渲染器属性与插槽。
 *
 * @module components/FormItem
 */

import { computed, defineComponent, h, PropType, toRef } from "vue"
import type { SetupContext, VNodeChild } from "vue"

import { isGroupSchema } from "@schemx/core"
import classnames from "classnames"
import { omit } from "es-toolkit"

import { useField } from "@/hooks"
import { useContext } from "@/hooks/useContext"
import { provideFieldContext } from "@/hooks/useFieldContext"
import { useFormInstance } from "@/hooks/useForm"
import { useStableRef } from "@/hooks/useStableRef"
import { extractChildSlots, mergeTrigger, resolveSlot, shouldValidateOn } from "@/utils"
import type { TriggerConfig } from "@/utils"

import FormGroup from "../FormGroup"

import type {
  SchemxBaseField,
  SchemxComponentProps,
  SchemxFormItemProps,
  SchemxResolvedField,
  SchemxResolvedGroupField,
  Values,
} from "@schemx/core"

/**
 * FormItem 属性。
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
    const form = useFormInstance<T>()
    const formContext = useContext()

    const { getRenderer } = form.getInternalHooks()

    // Vue 层只补齐表单上下文默认值；字段依赖属性的解析已经在 core runtime 完成。
    const resolvedProps = computed(() => {
      const schema = getSchema()

      return {
        visible: schema.visible ?? true,
        readonly: schema.readonly ?? formContext.readonly ?? false,
        disabled: schema.disabled ?? formContext.disabled ?? false,
        required: schema.required ?? !!schema.rules,
        placeholder: schema.placeholder ?? `${schema.label}为必填项`,
        componentProps: (schema.componentProps ?? {}) as SchemxComponentProps<T>,
        rules: schema.rules,
      }
    })

    const field = useField(schemaRef.value.name)

    provideFieldContext(field)

    const trigger = computed<TriggerConfig>(() =>
      mergeTrigger(
        getSchema().validationTrigger,
        formContext.validationTrigger,
        "onChange"
      )
    )

    /**
     * 是否需要进行校验。
     *
     * 当字段不可见、只读或禁用时，无需进行校验。
     */
    const canVerified = computed(() => {
      const schema = getSchema()
      const isOperate = schema.visible !== false && !schema.readonly && !schema.disabled
      // [] 代表没有有效规则，不能只用 truthy 判断。
      const hasRules = Array.isArray(schema.rules)
        ? schema.rules.length > 0
        : !!schema.rules

      return isOperate && hasRules
    })

    /** 值变化处理，设置值后根据触发时机决定是否校验 */
    const handleChange = (v: unknown) => {
      field.setValue(v)
      if (canVerified.value && shouldValidateOn("change", trigger.value)) {
        field.validate()
      }
    }

    /** 失焦处理，根据触发时机决定是否校验 */
    const handleBlur = () => {
      if (canVerified.value && shouldValidateOn("blur", trigger.value)) {
        field.validate()
      }
    }

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
        required: resolvedProps.value.required,
        readonly: resolvedProps.value.readonly,
        disabled: resolvedProps.value.disabled,
        visible: resolvedProps.value.visible,
        placeholder: resolvedProps.value.placeholder,
        validationTrigger: trigger.value,
      }
    })

    // 使用 useStableRef 避免每次生成新对象引用
    const componentProps = useStableRef<SchemxComponentProps<T>>(
      (): SchemxComponentProps<T> => ({
        ...resolvedProps.value.componentProps,
        visible: resolvedProps.value.visible,
        required: resolvedProps.value.required,
        readonly: resolvedProps.value.readonly,
        disabled: resolvedProps.value.disabled,
        placeholder: resolvedProps.value.placeholder,
        value: field.getValue(),
        onChange: handleChange,
        onBlur: handleBlur,
        formItemProps: formItemProps.value,
      })
    )

    /**
     * 渲染 required 星号。
     *
     * 当字段为必填且非禁用/只读状态时，在 label 前显示红色星号标记。
     *
     * @returns 星号 VNode 或空片段
     */
    const renderRequired = (): VNodeChild => {
      if (
        !resolvedProps.value.required ||
        resolvedProps.value.disabled ||
        resolvedProps.value.readonly
      ) {
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

      if (!resolvedProps.value.visible) {
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
            "is-readonly": resolvedProps.value.readonly,
            "is-disabled": resolvedProps.value.disabled,
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
