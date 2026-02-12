/**
 * SchemaForm - 主组件
 *
 * 基于 Schema 配置的表单组件，使用 useForm Hook 管理状态。
 *
 * @module SchemaForm
 */

import { App, CSSProperties, defineComponent, onMounted, PropType, ref } from "vue"

import { Button, Form } from "vant"

// Hooks

import classnames from "classnames"
import { omit } from "es-toolkit"

import FormItem from "./components/FormItem"
import { useForm } from "./hooks/useForm"
import { createFormContext } from "./hooks/useFormContext"
import { useRenderer } from "./hooks/useRenderer"
import globalPluginManager, {
  type Plugin as CorePlugin,
  type PluginOptions as CorePluginOptions,
  createPluginManager,
} from "./plugins"

import type { Plugin } from "./plugins"
import type { SchemaBaseColumn, SchemaFormProps } from "./types"

// ==================== 类型定义 ====================

/**
 * SchemaForm 安装选项
 */
export interface SchemaFormInstallOptions {
  /** 请求插件 */
  request?: Plugin | Function
}

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
      default: () => ({}),
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
  },

  emits: ["update:modelValue"],

  setup(props, { expose, slots, emit, attrs }) {
    // ==================== 核心模块初始化 ====================

    /** Vant Form 组件引用 */
    const formRef = ref<InstanceType<typeof Form> | null>(null)

    /** 提交状态 */
    const submitting = ref(false)

    /** 创建 RendererRegistry 实例并注册默认渲染器（通过 provide/inject 提供给子组件） */
    useRenderer()

    /** 创建 PluginManager 实例 */
    const pluginManager = createPluginManager()

    // ==================== 使用 useForm Hook ====================

    /**
     * 使用 useForm 创建表单实例
     * 这会自动提供 FormContext 给子组件
     */
    const form = useForm({
      columns: props.columns,
      initialValues: props.initialValues,

      onFinish: async (values) => {
        submitting.value = true
        try {
          // 触发 beforeSubmit 钩子
          await pluginManager.call("beforeSubmit", values)

          // 调用 onFinish 回调
          props.onFinish?.(values)

          // 触发 afterSubmit 钩子
          await pluginManager.call("afterSubmit", values, { success: true })
        } catch (error) {
          // 触发 onError 钩子
          if (error instanceof Error) {
            await pluginManager.call("onError", error)
          }

          // 触发 afterSubmit 钩子（失败情况）
          await pluginManager.call("afterSubmit", values, { success: false, error })
        } finally {
          submitting.value = false
        }
      },
      onFinishFailed: async (errors) => {
        props.onFinishFailed?.(errors)
      },
      onValuesChange: (changedValues, latestValues) => {
        // 触发 update:modelValue 事件
        emit("update:modelValue", latestValues)

        // 触发 onValuesChange 回调
        props.onValuesChange?.(changedValues, latestValues)

        // 触发 onFieldsChange 回调
        props.onFieldsChange?.(Object.keys(changedValues), Object.keys(latestValues))

        // 触发 onFieldChange 钩子
        Object.keys(changedValues).forEach((field) => {
          pluginManager.call("onFieldChange", field, changedValues[field], undefined)
        })
      },
    })

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
      form,
    })

    // ==================== 生命周期钩子 ====================

    onMounted(() => {
      pluginManager.call("afterMount", form)
    })

    // 触发 beforeMount 钩子
    pluginManager.call("beforeMount", form)

    // ==================== 暴露方法 ====================

    expose({
      ...form,
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
            // ==================== 依赖字段直接渲染 ====================
            // 获取 key：依赖字段使用 index，普通字段使用 name
            const key = `${column.componentType}-${(column as SchemaBaseColumn).name ? (column as SchemaBaseColumn).name : index}`

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
                onClick={() => form.submit()}
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
  use: (plugin: CorePlugin | Function, options?: CorePluginOptions) => typeof SchemaForm
  pluginManager: typeof globalPluginManager
  install: (app: App, options?: SchemaFormInstallOptions) => void
  FormItem: typeof FormItem
}

/** 添加静态方法支持插件系统 */
;(SchemaForm as SchemaFormType).use = (
  plugin: CorePlugin | Function,
  options: CorePluginOptions = {}
) => {
  globalPluginManager.use(plugin, options)

  return SchemaForm
}

/** 添加插件管理器访问 */
;(SchemaForm as SchemaFormType).pluginManager = globalPluginManager

/** 添加 Vue 插件支持 */
;(SchemaForm as SchemaFormType).install = (
  app: App,
  options: SchemaFormInstallOptions = {}
) => {
  app.component("SchemaForm", SchemaForm)

  if (options.request) {
    globalPluginManager.use(options.request as CorePlugin | Function)
  }
}

/** 添加 FormItem 组件引用 */
;(SchemaForm as SchemaFormType).FormItem = FormItem

export default SchemaForm as SchemaFormType
