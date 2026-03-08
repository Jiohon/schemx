/**
 * SchemaForm 统一导出入口
 *
 * @module @Jonhn/vschema-form
 */

import "./styles/index.scss"

/** 默认导出 */
export { default } from "./SchemaForm"
export { default as SchemaForm } from "./SchemaForm"

/** 核心功能 */
export * from "./core"

/** 渲染层 */
export * from "./renderer"

/** Hooks */
export * from "./hooks"
export { FORM_CONTEXT_KEY } from "./hooks/useFormContext"

/** 组件 */
export { default as FormItem } from "./components/FormItem"
export { default as FormDependency } from "./components/FormDependency"

/** 工具函数（显式导出，排除与 hooks 冲突的类型） */
export {
  createWatchField,
  createWatchFields,
  createWatchAll,
  type CreateWatchReturn,
  getInitialValuesFromColumns,
  resolveDynamicProp,
  resolveDynamicPropByBoolean,
  isBaseColumn,
  isGroupColumn,
  isDependencyColumn,
  isNestedColumn,
  shouldValidateOn,
} from "./utils"

/** 类型导出 */
export type { SchemaFormInstallOptions } from "./SchemaForm"

export type {
  FormValues,
  SchemaFormInstance,
  CustomRendererTypes,
  CustomRendererPropsMap,
  RendererPropsMap,
  RendererType,
  ValidationTrigger,
  DynamicProp,
  SchemaColumn,
  SchemaBaseColumn,
  ProcessedColumnConfig,
  SchemaFormProps,
} from "./types"
