/**
 * 表单级配置的 Vue provide/inject 适配。
 *
 * `SchemxForm` 通过 createFormConfigContext() 提供默认展示配置，
 * 字段组件通过 useFormConfigContext() 读取这些配置。
 *
 * @module hooks/provideFormConfigContext
 */

import { inject, type InjectionKey, provide } from "vue"

import type { SchemxFormProps } from "../types"
import type { Values } from "@schemx/core"

/** 表单级展示配置在 Vue provide/inject 中使用的注入 key。 */
export const SCHEMX_FORM_CONFIG_KEY = Symbol("schemx:form-config") as InjectionKey<
  FormContextProps<Values>
>

/**
 * formContextProps 类型排除值
 */
export const formConfigContextOmitKey = [
  "form",
  "modelValue",
  "rendererRegistry",
  "validatorRegistry",
  "defaultRendererType",
  "onFinish",
  "onFinishFailed",
  "onValuesChange",
  "onFieldsChange",
] as const

/**
 * formContextProps 类型排除值 - 类型
 */
export type FormConfigContextOmitKey = (typeof formConfigContextOmitKey)[number]

/**
 * 表单级默认配置。
 *
 * 该类型描述由 SchemxForm 提供给字段组件的配置上下文，排除表单实例、
 * 表单数据和回调等运行时处理属性，供字段组件读取默认展示行为。
 *
 * @typeParam TValues - 表单值类型
 */
export interface FormContextProps<TValues extends Values = Values> extends Omit<
  SchemxFormProps<TValues>,
  FormConfigContextOmitKey
> {}

/**
 * 创建并注入表单级配置上下文。
 *
 * 应在 `SchemxForm` 或自定义 Provider 的 setup() 同步阶段调用，
 * 使后代字段组件能够读取 readonly、disabled、labelAlign 等默认配置。
 *
 * @typeParam TValues - 表单值类型
 * @param props - 要提供给后代组件的表单级默认配置
 *
 * @remarks
 * 该函数只注册上下文，不创建或销毁表单实例，也不改变传入配置的所有权。
 *
 * @example
 * ```ts
 * createFormConfigContext({ readonly: true, labelAlign: "right" })
 * ```
 */
export const createFormConfigContext = <TValues extends Values = Values>(
  props: FormContextProps<TValues>
): void => {
  provide<FormContextProps<TValues>>(SCHEMX_FORM_CONFIG_KEY, props)
}

/**
 * `createFormConfigContext` 的兼容别名。
 *
 * @deprecated 请使用 createFormConfigContext。
 *
 * @example
 * ```ts
 * createContext({ disabled: true })
 * ```
 */
export const createContext = createFormConfigContext

/**
 * 获取最近祖先组件提供的表单级配置。
 *
 * 只能读取祖先组件通过 createFormConfigContext() 注册的配置，
 * 不能读取当前组件或后代组件提供的值。
 *
 * @returns 当前表单树中的表单级默认配置
 *
 * @throws Error 当前组件不在已注册表单配置上下文的后代组件树中时抛出
 *
 * @example
 * ```ts
 * const context = useFormConfigContext()
 * console.log(context.readonly, context.disabled)
 * ```
 */
export function useFormConfigContext(): FormContextProps {
  const context = inject<FormContextProps>(SCHEMX_FORM_CONFIG_KEY)

  if (!context) {
    throw new Error(
      "[schemx] useFormConfigContext() must be called inside a <SchemxForm> descendant. " +
        "Ensure createFormConfigContext(props) is called synchronously during setup()."
    )
  }

  return context
}

/**
 * `useFormConfigContext` 的兼容别名。
 *
 * @deprecated 请使用 useFormConfigContext。
 *
 * @example
 * ```ts
 * const context = useContext()
 * ```
 */
export const useContext = useFormConfigContext
