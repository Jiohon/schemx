/**
 * SchemaForm 统一导出入口
 *
 * @module @Jonhn/schemaForm
 */

import "./styles/index.css"

/** 默认导出 */
export { default } from "./SchemaForm"
export { default as SchemaForm } from "./SchemaForm"

/** 核心功能 */
export * from "./core"

/** Hooks */
export * from "./hooks"
export { FORM_CONTEXT_KEY } from "./hooks/useFormContext"

/** 组件 */
export { default as FormItem } from "./components/FormItem"
export { default as FormDependency } from "./components/FormDependency"

/** 工具函数 */
export {
  type DynamicProp,
  resolveDynamicProp,
  isBaseColumn,
  isGroupColumn,
  isDependencyColumn,
  isNestedColumn,
  shouldValidateOn,
} from "./utils"

/** 类型导出 */
export type {
  FormValues,
  SchemaFormInstance,
  CustomRendererMap,
  RendererType,
  ValidationTrigger,
  SchemaColumn,
  SchemaBaseColumn,
  SchemaFormProps,
} from "./types"
