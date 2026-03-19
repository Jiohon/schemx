/**
 * schemx 统一导出入口
 *
 * @module @schemx/core
 */

import "./styles/index.css"

/** 默认导出 */
export { default } from "./schemx"
export { default as schemx } from "./schemx"

/** Hooks */
export {
  useForm,
  useField,
  useWatch,
  useWatchField,
  useWatchFields,
  useWatchAll,
  useDependency,
  type UseDependencyReturn,
  useDictOptions,
  type DictOptionsAttrs,
  type UseDictOptionsReturn,
  type FormContextProps,
  useFormContext,
  createRenderer,
  useRendererContext,
  useRequester,
} from "./hooks"
export { FORM_CONTEXT_KEY } from "./hooks/useFormContext"

/** 组件 */
export { default as FormItem } from "./components/FormItem"
export { default as FormDependency } from "./components/FormDependency"
export { default as FormGroup } from "./components/FormGroup"

/** schemx/core 导出 */
export * from "@schemx/core"
