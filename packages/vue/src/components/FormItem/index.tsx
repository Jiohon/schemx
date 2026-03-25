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

import { isDependencySchema, isGroupSchema } from "@schemx/core"
import classnames from "classnames"
import { omit } from "es-toolkit"

import { useDictionary } from "@/hooks"
import { useContext } from "@/hooks/useContext"
import { useField } from "@/hooks/useField"
import { useRendererContext } from "@/hooks/useRenderer"
import { useWatchFields } from "@/hooks/useWatch"
import {
  extractChildSlots,
  resolveDynamicPropBatch,
  resolveSlot,
  shouldValidateOn,
} from "@/utils"
import { isShallowEqual } from "@/utils/equal"
import { mergeTrigger } from "@/utils/validation"

import FormDependency from "../FormDependency"
import FormGroup from "../FormGroup"

import type { FormItemProps, NamePath, SchemaBase, SchemxField } from "@schemx/core"

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

    const rendererRegistry = useRendererContext()
    const formContext = useContext()
    const baseSchema = props.schema as SchemaBase
    const field = useField(baseSchema.name)

    const dependencies = computed<NamePath[]>(() => {
      if (Object.hasOwn(baseSchema, "dependencies") && baseSchema.dependencies != null) {
        return Array.isArray(baseSchema.dependencies)
          ? baseSchema.dependencies
          : [baseSchema.dependencies]
      }

      return []
    })

    const resolvedVisible = ref(true)
    const resolvedReadonly = ref(false)
    const resolvedDisabled = ref(false)
    const resolvedRequired = ref(false)
    const resolvedPlaceholder = ref("")
    const resolvedComponentProps = ref<any>({})

    const { list } = useDictionary(baseSchema.dict)

    // 创建 debounced 批量动态属性解析器
    const resolveDynamicProps = resolveDynamicPropBatch<{
      placeholder: string
      componentProps: Record<string, unknown>
      readonly: boolean
      disabled: boolean
      visible: boolean
      required: boolean
    }>()

    // 合并 trigger
    const trigger = mergeTrigger(
      baseSchema.validationTrigger,
      formContext.validationTrigger,
      "onChange"
    )

    // 使用 shallowRef + watchEffect 避免每次生成新对象引用
    const processedComponentProps = shallowRef<FormItemProps>({} as FormItemProps)

    const formItemProps = computed<FormItemProps>(() => {
      return {
        ...omit(baseSchema, ["componentProps"]),
        name: baseSchema.name,
        componentType: baseSchema.componentType,
        class: classnames("schemx-item", baseSchema.className),
        required: resolvedRequired.value,
        readonly: resolvedReadonly.value,
        disabled: resolvedDisabled.value,
        visible: resolvedVisible.value,
      }
    })

    /**
     * 是否需要进行校验。
     *
     * 当字段不可见、只读或禁用时，无需进行校验。
     *
     * @returns boolean
     */
    const canVerified = computed(() => {
      const isOperate =
        resolvedVisible.value && !resolvedReadonly.value && !resolvedDisabled.value

      return !!(isOperate && Object.hasOwn(baseSchema, "rules"))
    })

    /** 值变化处理，设置值后根据触发时机决定是否校验 */
    const handleChange = (v: unknown) => {
      field.setValue(v)
      if (canVerified.value && shouldValidateOn("change", trigger)) {
        field.validate()
      }
    }

    /** 失焦处理，根据触发时机决定是否校验 */
    const handleBlur = () => {
      if (canVerified.value && shouldValidateOn("blur", trigger)) {
        field.validate()
      }
    }

    watchEffect(() => {
      const next: FormItemProps = {
        ...resolvedComponentProps.value,
        required: resolvedRequired.value,
        readonly: resolvedReadonly.value,
        disabled: resolvedDisabled.value,
        visible: resolvedVisible.value,
        value: field.getValue(),
        onChange: handleChange,
        onBlur: handleBlur,
        formItemProps: formItemProps.value,
      }

      if (!isShallowEqual(processedComponentProps.value, next)) {
        processedComponentProps.value = next
      }
    })

    // 解析所有的动态属性（debounced 批量解析，高频触发时只执行最后一次）
    useWatchFields(
      dependencies.value,
      (_payload, latestSnapshot) => {
        resolveDynamicProps(
          {
            placeholder: {
              value: baseSchema.placeholder,
              defaultValue: `${baseSchema.label}为必填项`,
            },
            componentProps: {
              value: baseSchema.componentProps,
              defaultValue: {},
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
          },
          latestSnapshot,
          (results) => {
            resolvedPlaceholder.value = results.placeholder
            resolvedComponentProps.value = results.componentProps
            resolvedReadonly.value = results.readonly
            resolvedDisabled.value = results.disabled
            resolvedVisible.value = results.visible
            resolvedRequired.value = results.required
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
     * @param baseSchema - 字段基础配置
     */
    const extractAndRegisterRules = (baseSchema: SchemaBase) => {
      if (!canVerified.value) return

      const defaultMessage =
        resolvedComponentProps.value?.placeholder || resolvedPlaceholder.value

      if (baseSchema.rules) {
        field.registerRules(baseSchema.rules, defaultMessage)
      }
    }

    // 设置默认的必填rule
    watch(
      [canVerified, resolvedComponentProps, resolvedPlaceholder],
      () => {
        if (!canVerified.value) {
          field.clearError()
          field.unregisterRules()
        } else {
          extractAndRegisterRules(baseSchema)
        }
      },
      { immediate: true }
    )

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
      if (!resolvedRequired.value || resolvedDisabled.value || resolvedReadonly.value) {
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
      const columnElement = h(component, processedComponentProps.value, childSlots)

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
      if (!resolvedVisible.value) {
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
            "is-readonly": resolvedReadonly.value,
            "is-disabled": resolvedDisabled.value,
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
