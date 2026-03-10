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
import { createRequiredSchema } from "../../core/standardSchema"
import { useWatchFields } from "../../hooks"
import { useField } from "../../hooks/useField"
import { useFormContext } from "../../hooks/useFormContext"
import { useRendererContext } from "../../hooks/useRenderer"
import {
  isDependencyColumn,
  isGroupColumn,
  isNestedColumn,
  resolveDynamicProp,
  resolveDynamicPropByBoolean,
  shouldValidateOn,
} from "../../utils"

import FormDependency from "../FormDependency"
import FormGroup from "../FormGroup"
import FormNested from "../FormNested"

import type { FormItemProps, SchemaBaseColumn, SchemaColumn } from "../../types"

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

    const dependencies = computed(() => {
      if (Object.hasOwn(baseColumn, "dependencies")) {
        return Array.isArray(baseColumn.dependencies)
          ? baseColumn.dependencies
          : [baseColumn.dependencies]
      }

      return []
    })

    const resolvedReadonly = ref(false)
    const resolvedDisabled = ref(false)
    const resolvedHidden = ref(false)
    const resolvedRequired = ref(false)
    const resolvedPlaceholder = ref("")

    const resolvedComponentProps = ref<any>({})

    // 稳定的 onChange 引用，避免每次渲染创建新函数导致子组件无限更新
    const trigger = baseColumn.validationTrigger ?? formContext.validationTrigger

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

    const formItemProps = computed<Omit<FormItemProps, "componentProps">>(() => {
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

    /**
     * 浅比较两个对象的自有属性值是否相同。
     *
     * 用于避免 computed 每次返回新对象引用导致子组件不必要的更新。
     * 仅比较第一层属性，函数引用通过 === 判断。
     *
     * @param a - 旧对象
     * @param b - 新对象
     * @returns 两个对象浅相等时返回 true
     */
    const shallowEqual = (a: Record<string, any>, b: Record<string, any>): boolean => {
      const keysA = Object.keys(a)
      const keysB = Object.keys(b)
      if (keysA.length !== keysB.length) return false
      return keysA.every((key) => a[key] === b[key])
    }

    // 使用 shallowRef + watchEffect 避免每次生成新对象引用
    const processedComponentProps = shallowRef<Record<string, any>>({})

    watchEffect(() => {
      const next: Record<string, any> = {
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

      if (!shallowEqual(processedComponentProps.value, next)) {
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

        resolveDynamicPropByBoolean(
          baseColumn.required,
          latestSnapshot,
          !!baseColumn.rules
        ).then((data) => {
          resolvedRequired.value = data
        })
      },
      {
        immediate: true,
      }
    )

    /**
     * 提取规则配置并注册到字段。
     *
     * 当 rules 为 "required" 时使用 createRequiredSchema 构造必填规则，
     * 同时将 placeholder 作为 defaultMessage 传给 registerRule，
     * 用于空值拦截时的错误提示。
     *
     * @param baseColumn - 字段基础配置
     */
    const extractAndRegisterRules = (baseColumn: SchemaBaseColumn) => {
      if (!Object.hasOwn(baseColumn, "rules")) return

      const placeholder =
        resolvedComponentProps.value?.placeholder ||
        resolvedPlaceholder.value ||
        `${baseColumn.label}为必填项`

      if (baseColumn.rules === "required") {
        field.registerRule(createRequiredSchema(placeholder), placeholder)
      } else if (baseColumn.rules) {
        field.registerRule(baseColumn.rules, placeholder)
      }
    }

    // 设置默认的必填rule
    watch(
      resolvedHidden,
      () => {
        if (resolvedHidden.value) {
          field.clearError()
          field.unregisterRule()
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
      }
    })

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
