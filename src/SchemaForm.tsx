/**
 * SchemaForm - 主组件
 *
 * 基于 Schema 配置的表单组件，使用 useForm Hook 管理状态。
 *
 * @module SchemaForm
 */

import { App, CSSProperties, defineComponent, PropType } from "vue"

import classnames from "classnames"

import FormItem from "./components/FormItem"
import { globalRegistry } from "./core/registry"
import { useForm } from "./hooks/useForm"
import { createFormContext } from "./hooks/useFormContext"
import { createRenderer } from "./hooks/useRenderer"
import {
  _clearGlobalRequest,
  _setGlobalRequest,
} from "./hooks/useRequester/globalRequestProvider"
import { isBaseColumn } from "./utils"
import { collectObjectPathsByLeaf } from "./utils/path"

import type { Registry } from "./core/registry"
import type { SchemaFormProps } from "./types"

import "./styles/index.css"

/**
 * SchemaForm 组件
 *
 * 基于 Schema 配置驱动的表单，内部通过 useForm 管理状态，
 * 并自动向子组件提供 FormContext。
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
    labelPosition: {
      type: String as PropType<SchemaFormProps["labelPosition"]>,
      default: "left",
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
    rendererRegistry: {
      type: Object as PropType<Registry>,
      default: undefined,
    },
    request: {
      type: Function as PropType<SchemaFormProps["request"]>,
      default: undefined,
    },
  },

  emits: ["update:modelValue"],

  setup(props, { expose, slots, emit, attrs }) {
    /**
     * 获取或创建表单实例
     *
     * 优先使用外部传入的 form，否则内部通过 useForm 创建。
     * 必须在 setup 同步阶段调用，确保 provide 正确注入。
     */
    const form = props.form
      ? props.form
      : useForm({
          columns: props.columns,
          initialValues: props.initialValues,

          onFinish: async (values) => {
            props.onFinish?.(values)
          },
          onFinishFailed: async (errors) => {
            props.onFinishFailed?.(errors)
          },
          onValuesChange: (changedValues, latestSnapshot) => {
            emit("update:modelValue", latestSnapshot)
            props.onValuesChange?.(changedValues, latestSnapshot)
            props.onFieldsChange?.(
              collectObjectPathsByLeaf(changedValues),
              collectObjectPathsByLeaf(latestSnapshot)
            )
          },
          onFieldsChange: (changedPaths, allPaths) => {
            props.onFieldsChange?.(changedPaths, allPaths)
          },
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
      labelPosition: props.labelPosition,
      labelWidth: props.labelWidth,
      colon: props.colon,
      className: props.className,
      style: props.style,
      request: props.request,
    })

    expose({
      ...form,
    })

    return () => (
      <div
        class={classnames("schema-form", props.className)}
        style={
          {
            "--schema-form-input-align": (attrs.align as string) ?? "right",
          } as CSSProperties
        }
      >
        {props.columns?.map((column, index) => {
          const key = `${column.componentType}-${isBaseColumn(column) ? column.name : index}`

          return <FormItem key={key} column={{ ...column, ...attrs }} v-slots={slots} />
        })}
      </div>
    )
  },
})

/**
 * SchemaForm 组件完整类型
 *
 * 包含组件本体及挂载的静态方法和属性。
 *
 * @example
 * ```ts
 * import SchemaForm from '@user/schemaForm'
 *
 * // 作为 Vue 插件安装
 * app.use(SchemaForm)
 *
 * // 注册全局请求器
 * SchemaForm.registerRequest((url) => fetch(url).then(r => r.json()))
 *
 * // 访问子组件
 * SchemaForm.FormItem
 * ```
 */
type SchemaFormType = typeof SchemaForm & {
  /** Vue 插件安装方法 */
  install: (app: App) => void
  /** FormItem 子组件引用 */
  FormItem: typeof FormItem
  /**
   * 注册全局请求器
   *
   * 作为三级优先级中的最低级兜底（全局 < 表单实例 < 字段级）。
   *
   * @param request - HTTP 请求函数
   */
  registerRequest: (request: (url: string) => Promise<any>) => void
  /**
   * 清除全局请求器
   *
   * @remarks 仅用于测试环境
   */
  clearRequest: () => void
}

/** 挂载静态方法和属性到组件上 */
Object.assign(SchemaForm, {
  install(app: App) {
    app.component("SchemaForm", SchemaForm)
  },
  FormItem,
  registerRequest: _setGlobalRequest,
  clearRequest: _clearGlobalRequest,
})

export default SchemaForm as SchemaFormType
