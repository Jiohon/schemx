/**
 * SchemaForm - 主组件
 *
 * 基于 Schema 配置的表单组件，使用 useForm Hook 管理状态。
 *
 * @module SchemaForm
 */

import { App, computed, CSSProperties, defineComponent, PropType, ref } from "vue"

import { Button, Form } from "vant"

import classnames from "classnames"
import { omit } from "es-toolkit"

import FormItem from "./components/FormItem"
import { useForm } from "./hooks/useForm"
import { createFormContext } from "./hooks/useFormContext"
import { createRenderer } from "./hooks/useRenderer"
import { globalRegistry } from "./renderer/rendererRegistry"

import type { Registry } from "./renderer/rendererRegistry"
import type { SchemaFormProps } from "./types"

// ==================== 类型定义 ====================

/**
 * SchemaForm 安装选项
 */
export interface SchemaFormInstallOptions {}

// ==================== 组件定义 ====================

/**
 * SchemaForm 组件
 */
const SchemaForm = defineComponent<SchemaFormProps>({
  name: "SchemaForm",

  props: {
    modelValue: {
      type: Object as PropType<SchemaFormProps["modelValue"]>,
      default: () => ({}),
    },
    initialValues: {
      type: Object as PropType<SchemaFormProps["initialValues"]>,
      default: () => ({}),
    },
    validationTrigger: {
      type: String as PropType<SchemaFormProps["validationTrigger"]>,
      default: "onBlur",
    },
    form: {
      type: Object as PropType<SchemaFormProps["form"]>,
      default: undefined,
    },
    columns: {
      type: Array as PropType<SchemaFormProps["columns"]>,
      default: () => [],
    },
    readonly: {
      type: Boolean as PropType<SchemaFormProps["readonly"]>,
      default: false,
    },
    disabled: {
      type: Boolean as PropType<SchemaFormProps["disabled"]>,
      default: false,
    },
    labelWidth: {
      type: String as PropType<SchemaFormProps["labelWidth"]>,
      default: "auto",
    },
    labelAlign: {
      type: String as PropType<SchemaFormProps["labelAlign"]>,
      default: "right",
    },
    colon: {
      type: Boolean as PropType<SchemaFormProps["colon"]>,
      default: true,
    },
    className: {
      type: String as PropType<SchemaFormProps["className"]>,
      default: "",
    },
    style: {
      type: Object as PropType<SchemaFormProps["style"]>,
      default: () => ({}),
    },
    onFinish: {
      type: Function as PropType<SchemaFormProps["onFinish"]>,
      default: null,
    },
    onFinishFailed: {
      type: Function as PropType<SchemaFormProps["onFinishFailed"]>,
      default: null,
    },
    onValuesChange: {
      type: Function as PropType<SchemaFormProps["onValuesChange"]>,
      default: null,
    },
    onFieldsChange: {
      type: Function as PropType<SchemaFormProps["onFieldsChange"]>,
      default: null,
    },
    footer: {
      type: [Object, Function, Boolean] as PropType<SchemaFormProps["footer"]>,
      default: false,
    },
    submitButtonText: {
      type: String as PropType<SchemaFormProps["submitButtonText"]>,
      default: "提交",
    },
    submitButtonProps: {
      type: Object as PropType<SchemaFormProps["submitButtonProps"]>,
      default: () => ({}),
    },
    rendererRegistry: {
      type: Object as PropType<Registry>,
      default: undefined,
    },
  },

  emits: ["update:modelValue"],

  setup(props, { expose, slots, emit, attrs }) {
    // ==================== 核心模块初始化 ====================

    /** Vant Form 组件引用 */
    const formRef = ref<InstanceType<typeof Form> | null>(null)

    /** 提交状态 */
    const submitting = ref(false)

    // ==================== 使用 useForm Hook ====================

    /**
     * 使用 useForm 创建表单实例
     * 这会自动提供 FormContext 给子组件
     */
    const form = computed(() => {
      if (props.form) {
        return props.form
      }

      return useForm({
        columns: props.columns,
        initialValues: props.initialValues,

        onFinish: async (values) => {
          submitting.value = true
          try {
            props.onFinish?.(values)
          } finally {
            submitting.value = false
          }
        },
        onFinishFailed: async (errors) => {
          props.onFinishFailed?.(errors)
        },
        onValuesChange: (changedValues, latestValues) => {
          emit("update:modelValue", latestValues)
          props.onValuesChange?.(changedValues, latestValues)
          props.onFieldsChange?.(Object.keys(changedValues), Object.keys(latestValues))
        },
      })
    })

    if (!props.rendererRegistry) {
      createRenderer(globalRegistry)
    }

    createFormContext({
      validationTrigger: props.validationTrigger,
      columns: props.columns,
      readonly: props.readonly,
      disabled: props.disabled,
      labelAlign: props.labelAlign,
      labelWidth: props.labelWidth,
      colon: props.colon,
      className: props.className,
      style: props.style,
    })

    // ==================== 暴露方法 ====================

    expose({
      ...form.value,
    })

    // ==================== 渲染 ====================

    return () => (
      <div
        class={classnames("schema-form", props.className)}
        style={
          {
            "--schema-form-input-align": (attrs.align as string) ?? "right",
          } as CSSProperties
        }
      >
        <Form
          ref={formRef}
          class="vant-form"
          disabled={props.disabled}
          readonly={props.readonly}
          style={props.style}
          errorMessageAlign="right"
          {...omit({ ...attrs }, [
            "columns",
            "className",
            "initialValues",
            "disabled",
            "readonly",
            "style",
            "validateTrigger",
          ])}
          required="auto"
        >
          {/* 渲染基础字段 */}
          {props.columns?.map((column, index) => {
            const key = `${column.componentType}-${"name" in column ? column.name : index}`

            return (
              <FormItem
                key={key}
                column={{ ...column, ...(attrs as Record<string, any>) }}
                v-slots={slots}
              />
            )
          })}

          {/* 底部按钮 */}
          {props.footer && !props.readonly && (
            <div class="schema-form-submit-button">
              <Button
                round
                block
                type="primary"
                loading={submitting.value}
                disabled={props.disabled}
                onClick={() => form.value.submit()}
                {...props.submitButtonProps}
              >
                {props.submitButtonText}
              </Button>
            </div>
          )}
        </Form>
      </div>
    )
  },
})

// ==================== 静态方法和属性 ====================

/**
 * 扩展组件类型以支持静态方法
 */
type SchemaFormType = typeof SchemaForm & {
  install: (app: App, options?: SchemaFormInstallOptions) => void
  FormItem: typeof FormItem
}

/** 添加 Vue 插件支持 */
;(SchemaForm as SchemaFormType).install = (
  app: App,
  _options: SchemaFormInstallOptions = {}
) => {
  app.component("SchemaForm", SchemaForm)
}

/** 添加 FormItem 组件引用 */
;(SchemaForm as SchemaFormType).FormItem = FormItem

export default SchemaForm as SchemaFormType
