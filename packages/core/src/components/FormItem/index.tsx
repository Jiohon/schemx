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

import {
  computed,
  defineComponent,
  h,
  onMounted,
  PropType,
  ref,
  shallowRef,
  watch,
  watchEffect,
} from "vue"

import classnames from "classnames"
import { omit } from "es-toolkit"

import { useWatchFields } from "@/hooks"
import { useField } from "@/hooks/useField"
import { useFormContext } from "@/hooks/useFormContext"
import { useRendererContext } from "@/hooks/useRenderer"
import type { FormItemProps, SchemaBaseColumn, SchemaColumn } from "@/types"
import {
  extractChildSlots,
  isDependencyColumn,
  isGroupColumn,
  isNestedColumn,
  resolveDynamicProp,
  resolveSlot,
  shouldValidateOn,
} from "@/utils"
import { isShallowEqual } from "@/utils/equal"
import { mergeTrigger } from "@/utils/validation"

import FormDependency from "../FormDependency"
import FormGroup from "../FormGroup"
import FormNested from "../FormNested"

const FormItem = defineComponent({
  name: "SchemaFormItem",

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

    const dependencies = computed(() => {
      if (Object.hasOwn(baseColumn, "dependencies")) {
        return Array.isArray(baseColumn.dependencies)
          ? baseColumn.dependencies
          : [baseColumn.dependencies]
      }

      return []
    })

    const resolvedHidden = ref(false)
    const resolvedReadonly = ref(false)
    const resolvedDisabled = ref(false)
    const resolvedRequired = ref(false)
    const resolvedPlaceholder = ref("")
    const resolvedComponentProps = ref<any>({})

    // 合并 trigger
    const trigger = mergeTrigger(
      baseColumn.validationTrigger,
      formContext.validationTrigger,
      "onChange"
    )

    // 使用 shallowRef + watchEffect 避免每次生成新对象引用
    const processedComponentProps = shallowRef<FormItemProps>({} as FormItemProps)

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

    const formItemProps = computed<FormItemProps>(() => {
      return {
        ...omit(baseColumn, ["componentProps"]),
        name: baseColumn.name,
        componentType: baseColumn.componentType,
        class: classnames("schema-form-item", baseColumn.className),
        required: resolvedRequired.value,
        readonly: resolvedReadonly.value,
        disabled: resolvedDisabled.value,
        hidden: resolvedHidden.value,
      }
    })

    watchEffect(() => {
      const next: FormItemProps = {
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

      if (!isShallowEqual(processedComponentProps.value, next)) {
        processedComponentProps.value = next
      }
    })

    // 解析所有的动态属性
    useWatchFields(
      dependencies.value,
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

        resolveDynamicProp(
          baseColumn.readonly,
          latestSnapshot,
          formContext.readonly as boolean
        ).then((data) => {
          resolvedReadonly.value = data
        })

        resolveDynamicProp(
          baseColumn.disabled,
          latestSnapshot,
          formContext.disabled as boolean
        ).then((data) => {
          resolvedDisabled.value = data
        })

        resolveDynamicProp(baseColumn.hidden, latestSnapshot, false).then((data) => {
          resolvedHidden.value = data
        })

        resolveDynamicProp(baseColumn.required, latestSnapshot, !!baseColumn.rules).then(
          (data) => {
            resolvedRequired.value = data
          }
        )
      },
      {
        immediate: true,
      }
    )

    /**
     * 提取规则配置并注册到字段。
     *
     * 当 rules 为字符串时，通过 schemaRegistry.resolve 查找对应的 schema，
     * 工厂函数会自动传入 label 生成实例。
     * 同时将 placeholder 作为 defaultMessage 传给 registerRule，
     * 用于空值拦截时的错误提示。
     *
     * @param baseColumn - 字段基础配置
     */
    const extractAndRegisterRules = (baseColumn: SchemaBaseColumn) => {
      if (!Object.hasOwn(baseColumn, "rules")) return

      const defaultMessage =
        resolvedComponentProps.value?.placeholder || resolvedPlaceholder.value

      if (baseColumn.rules) {
        field.registerRules(baseColumn.rules, defaultMessage)
      }
    }

    // 设置默认的必填rule
    watch(
      [
        resolvedHidden,
        resolvedDisabled,
        resolvedReadonly,
        resolvedComponentProps,
        resolvedPlaceholder,
      ],
      () => {
        if (resolvedHidden.value || resolvedReadonly.value || resolvedDisabled.value) {
          field.clearError()
          field.unregisterRules()
        } else {
          extractAndRegisterRules(baseColumn)
        }
      },
      { immediate: true }
    )

    onMounted(() => {
      if (Object.hasOwn(baseColumn, "initialValue")) {
        field.setInitialValue(baseColumn.initialValue)
        field.setValue(baseColumn.initialValue)
      } else {
        field.setInitialValue(undefined)
      }
    })

    /**
     * 渲染 required 星号。
     *
     * 当字段为必填且非禁用/只读状态时，在 label 前显示红色星号标记。
     *
     * @returns 星号 VNode 或空片段
     */
    const renderRequired = () => {
      if (!resolvedRequired.value || resolvedDisabled.value || resolvedReadonly.value) {
        return <></>
      }

      return <span class="schema-form-item__required">*</span>
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
      const labelSlot = resolveSlot(slots, `${baseColumn.name}Label`)

      if (labelSlot) {
        return labelSlot(formItemProps.value)
      }

      const labelAlign = baseColumn.labelAlign || formContext.labelAlign
      const labelWidth = baseColumn.labelWidth || formContext.labelWidth
      const colon = baseColumn.colon ?? formContext.colon

      return (
        <label
          class="schema-form-item__label"
          style={{ width: labelWidth, textAlign: labelAlign }}
        >
          {renderRequired()}
          <span class="schema-form-item__label-text">
            {baseColumn.label}
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
      const component = rendererRegistry.getRenderer(baseColumn.componentType)

      if (!component) {
        throw new Error(
          `[SchemaForm] Can not find component renderer of "${baseColumn.componentType}".`
        )
      }

      // 提取子渲染器插槽（fieldName:slotName 格式）
      const childSlots = extractChildSlots(String(baseColumn.name), slots)
      const columnElement = h(component, processedComponentProps.value, childSlots)

      const contentSlot = resolveSlot(slots, `${baseColumn.name}Content`)

      if (contentSlot) {
        return contentSlot({
          ...formItemProps.value,
          columnElement,
        })
      }

      if (!columnElement) return null

      return <div class="schema-form-item__control">{columnElement}</div>
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
      const errorSlot = resolveSlot(slots, `${baseColumn.name}Error`)

      if (errorSlot) {
        return errorSlot({
          ...formItemProps.value,
          errors: field.error.value,
        })
      }

      if (!Array.isArray(field.error.value) || field.error.value.length === 0) {
        return null
      }

      return <div class="schema-form-item__error">{field.error.value[0]}</div>
    }

    return () => {
      if (resolvedHidden.value) {
        return null
      }

      // 整体插槽：完全接管渲染，不包裹任何默认结构
      const itemSlot = resolveSlot(slots, String(baseColumn.name))

      if (itemSlot) {
        return itemSlot(formItemProps.value)
      }

      const labelPosition = baseColumn.labelPosition || formContext.labelPosition

      return (
        <div
          class={classnames("schema-form-item-wrapper", {
            "is-readonly": resolvedReadonly.value,
            "is-disabled": resolvedDisabled.value,
          })}
        >
          <div
            class={classnames(
              "schema-form-item",
              `schema-form-item--label-${labelPosition}`,
              baseColumn.className
            )}
          >
            {renderLabel()}

            <div class="schema-form-item__content">
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
