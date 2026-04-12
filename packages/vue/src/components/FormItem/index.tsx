/**
 * FormItem
 *
 * schemx、FormGroup、FormDependency 实际渲染的组件。
 * 负责: isDependencySchema 守卫、useField()、useRendererContext()、useFormContext()、
 * resolveDynamicProp()、slot 系统 (#nameItem, #name)、renderer h() 调用。
 * 处理列配置后将解析的数据传递给 FormItem 进行渲染。
 *
 * @module components/FormItem
 */

import { computed, defineComponent, h, onMounted, PropType } from "vue"

import { isDependencySchema, isGroupSchema } from "@schemx/core"
import classnames from "classnames"
import { omit } from "es-toolkit"

import { useContext } from "@/hooks/useContext"
import { useFieldHandler } from "@/hooks/useFieldHandler"
import { useRendererContext } from "@/hooks/useRenderer"
import { useResolvedProps } from "@/hooks/useResolvedProps"
import { useStableRef } from "@/hooks/useStableRef"
import { extractChildSlots, resolveSlot } from "@/utils"

import FormDependency from "../FormDependency"
import FormGroup from "../FormGroup"

import type { ComponentProps, FormItemProps, NamePath, SchemxField } from "@schemx/core"

const FormItem = defineComponent({
  name: "SchemxItem",

  props: {
    schema: {
      type: Object as PropType<SchemxField>,
      required: true,
    },
  },

  setup(props, { slots }) {
    if (isDependencySchema(props.schema)) {
      const depColumn = props.schema

      return () => (
        <FormDependency to={depColumn.to} renderer={depColumn.renderer} v-slots={slots} />
      )
    }

    if (isGroupSchema(props.schema)) {
      const groupColumn = props.schema

      return () => (
        <FormGroup
          children={groupColumn.children}
          collapsible={groupColumn.collapsible}
          defaultCollapsed={groupColumn.defaultCollapsed}
          v-slots={slots}
        />
      )
    }

    const baseSchema = props.schema

    const rendererRegistry = useRendererContext()
    const formContext = useContext()

    const dependencies: NamePath[] =
      baseSchema.dependencies != null
        ? Array.isArray(baseSchema.dependencies)
          ? baseSchema.dependencies
          : [baseSchema.dependencies]
        : []

    const resolvedProps = useResolvedProps(dependencies, {
      placeholder: {
        value: baseSchema.placeholder,
        defaultValue: `${baseSchema.label}为必填项`,
      },
      componentProps: {
        value: baseSchema.componentProps,
        defaultValue: {} as ComponentProps,
      },
      readonly: {
        value: baseSchema.readonly,
        defaultValue: formContext.readonly ?? false,
      },
      disabled: {
        value: baseSchema.disabled,
        defaultValue: formContext.disabled ?? false,
      },
      visible: {
        value: baseSchema.visible,
        defaultValue: true,
      },
      required: {
        value: baseSchema.required,
        defaultValue: !!baseSchema.rules,
      },
    })

    const { field, trigger, handleChange, handleBlur } = useFieldHandler(
      baseSchema,
      resolvedProps
    )

    /**
     * schemas 每一项的 props
     */
    const formItemProps = computed<FormItemProps>((): FormItemProps => {
      return {
        ...(omit(baseSchema, ["componentProps"]) satisfies FormItemProps),
        name: baseSchema.name,
        componentType: baseSchema.componentType,
        className: classnames("schemx-item", baseSchema.className),
        required: resolvedProps.required,
        readonly: resolvedProps.readonly,
        disabled: resolvedProps.disabled,
        visible: resolvedProps.visible,
        placeholder: resolvedProps.placeholder,
        validationTrigger: trigger,
      }
    })

    // 使用 useStableRef 避免每次生成新对象引用
    const componentProps = useStableRef<ComponentProps>(() => ({
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
    }))

    onMounted(() => {
      const value = Object.hasOwn(baseSchema, "initialValue")
        ? baseSchema.initialValue
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
    const renderRequired = () => {
      if (!resolvedProps.required || resolvedProps.disabled || resolvedProps.readonly) {
        return <></>
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
    const renderLabel = () => {
      const labelSlot = resolveSlot(slots, `${baseSchema.name}Label`)

      if (labelSlot) {
        return labelSlot(formItemProps.value)
      }

      const labelAlign = baseSchema.labelAlign || formContext.labelAlign
      const labelWidth = baseSchema.labelWidth || formContext.labelWidth
      const colon = baseSchema.colon ?? formContext.colon

      return (
        <label
          class="schemx-item__label"
          style={{ width: labelWidth, textAlign: labelAlign }}
        >
          {renderRequired()}
          <span class="schemx-item__label-text">
            {baseSchema.label}
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
    const renderContent = () => {
      const component = rendererRegistry.getRenderer(baseSchema.componentType)

      if (!component) {
        throw new Error(
          `[schemx] Can not find component renderer of "${baseSchema.componentType}".`
        )
      }

      // 提取子渲染器插槽（fieldName:slotName 格式）
      const childSlots = extractChildSlots(baseSchema.name, slots)
      const columnElement = h(component, componentProps.value, childSlots)

      const contentSlot = resolveSlot(slots, `${baseSchema.name}Content`)

      if (contentSlot) {
        return contentSlot({
          ...formItemProps.value,
          columnElement,
        })
      }

      if (!columnElement) return null

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
    const renderError = () => {
      const errorSlot = resolveSlot(slots, `${baseSchema.name}Error`)

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

    return () => {
      if (!resolvedProps.visible) {
        return null
      }

      // 整体插槽：完全接管渲染，不包裹任何默认结构
      const itemSlot = resolveSlot(slots, baseSchema.name)

      if (itemSlot) {
        return itemSlot(formItemProps.value)
      }

      const labelPosition = baseSchema.labelPosition || formContext.labelPosition

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
              baseSchema.className
            )}
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
})

export default FormItem
