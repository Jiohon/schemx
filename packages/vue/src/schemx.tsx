/**
 * schemx - 主组件
 *
 * 基于 Schema 配置的表单组件，使用 useForm Hook 管理状态。
 *
 * @module schemx
 */

import { App, CSSProperties, defineComponent, PropType } from "vue"

import { rendererRegistry } from "@schemx/core"
import { isBaseSchema } from "@schemx/core"
import classnames from "classnames"
import { omit } from "es-toolkit"

import type { SchemxFormProps } from "@/types/form"
import { requestProvider } from "@/utils/requestProvider"

import FormItem from "./components/FormItem"
import { createContext } from "./hooks/useContext"
import { useForm } from "./hooks/useForm"
import { createRenderer } from "./hooks/useRenderer"
import { collectObjectPathsByLeaf } from "./utils/path"

import type { RendererRegistry } from "@schemx/core"

import "./styles/index.css"

/**
 * schemx 组件
 *
 * 基于 Schema 配置驱动的表单，内部通过 useForm 管理状态，
 * 并自动向子组件提供 FormContext。
 */
const SchemxForm = defineComponent<SchemxFormProps>({
  name: "SchemxForm",

  props: {
    modelValue: {
      type: Object as PropType<SchemxFormProps["modelValue"]>,
      default: () => ({}),
    },
    initialValues: {
      type: Object as PropType<SchemxFormProps["initialValues"]>,
      default: () => ({}),
    },
    validationTrigger: {
      type: String as PropType<SchemxFormProps["validationTrigger"]>,
      default: "onBlur",
    },
    form: {
      type: Object as PropType<SchemxFormProps["form"]>,
      default: undefined,
    },
    schemas: {
      type: Array as PropType<SchemxFormProps["schemas"]>,
      default: () => [],
    },
    readonly: {
      type: Boolean as PropType<SchemxFormProps["readonly"]>,
      default: false,
    },
    disabled: {
      type: Boolean as PropType<SchemxFormProps["disabled"]>,
      default: false,
    },
    labelWidth: {
      type: String as PropType<SchemxFormProps["labelWidth"]>,
      default: "auto",
    },
    labelAlign: {
      type: String as PropType<SchemxFormProps["labelAlign"]>,
      default: "right",
    },
    labelPosition: {
      type: String as PropType<SchemxFormProps["labelPosition"]>,
      default: "left",
    },
    colon: {
      type: Boolean as PropType<SchemxFormProps["colon"]>,
      default: true,
    },
    className: {
      type: String as PropType<SchemxFormProps["className"]>,
      default: "",
    },
    style: {
      type: Object as PropType<SchemxFormProps["style"]>,
      default: () => ({}),
    },
    onFinish: {
      type: Function as PropType<SchemxFormProps["onFinish"]>,
      default: null,
    },
    onFinishFailed: {
      type: Function as PropType<SchemxFormProps["onFinishFailed"]>,
      default: null,
    },
    onValuesChange: {
      type: Function as PropType<SchemxFormProps["onValuesChange"]>,
      default: null,
    },
    onFieldsChange: {
      type: Function as PropType<SchemxFormProps["onFieldsChange"]>,
      default: null,
    },
    rendererRegistry: {
      type: Object as PropType<RendererRegistry>,
      default: undefined,
    },
    request: {
      type: Function as PropType<SchemxFormProps["request"]>,
      default: undefined,
    },
  },

  emits: ["update:modelValue"],

  setup(props, { expose, slots, emit, attrs }) {
    /**
     * 创建 FormContext 上下文
     *
     * 为子组件提供表单配置信息。
     */
    createContext(
      omit(props, [
        "modelValue",
        "form",
        "rendererRegistry",
        "onFinish",
        "onFinishFailed",
        "onValuesChange",
        "onFieldsChange",
      ])
    )

    /**
     * 获取或创建表单实例
     *
     * 优先使用外部传入的 form，否则内部通过 useForm 创建。
     * 必须在 setup 同步阶段调用，确保 provide 正确注入。
     */
    const form = props.form
      ? props.form
      : useForm({
          schemas: props.schemas,
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
      createRenderer(rendererRegistry)
    }

    expose({
      ...form,
    })

    return () => (
      <div
        class={classnames("schemx", props.className)}
        style={
          {
            "--schemx-input-align": (attrs.align as string) ?? "right",
          } as CSSProperties
        }
      >
        {props.schemas?.map((schema, index) => {
          const key = `${schema.componentType}-${isBaseSchema(schema) ? schema.name : index}`

          return <FormItem key={key} schema={{ ...schema, ...attrs }} v-slots={slots} />
        })}
      </div>
    )
  },
})

/**
 * schemx 组件完整类型
 *
 * 包含组件本体及挂载的静态方法和属性。
 *
 * @example
 * ```ts
 * import schemx from '@schemx/core'
 *
 * // 作为 Vue 插件安装
 * app.use(schemx)
 *
 * // 注册全局请求器
 * schemx.registerRequest((url) => fetch(url).then(r => r.json()))
 *
 * // 访问子组件
 * schemx.FormItem
 * ```
 */
type SchemxFormType = typeof SchemxForm & {
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
Object.assign(SchemxForm, {
  install(app: App) {
    app.component("SchemxForm", SchemxForm)
  },
  FormItem,
  registerRequest: requestProvider.register,
  clearRequest: requestProvider.clear,
})

export default SchemxForm as SchemxFormType
