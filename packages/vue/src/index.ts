/**
 * schemx 统一导出入口
 *
 * @module @schemx/core
 */

import "./styles/index.css"

/** 默认导出 */
export { default } from "./form"
export { default as schemxForm } from "./form"

/** Hooks */
export {
  useForm,
  useField,
  useWatch,
  useWatchField,
  useWatchFields,
  useWatchAll,
  useDependency,
  useDictionary,
  useContext,
  createRenderer,
  useRendererContext,
  useEffect,
  type UseDependencyReturn,
  type UseDictionaryOptions,
  type UseDictOptionsReturn,
  type FormContextProps,
} from "./hooks"

/** 高阶组件 */
export { WithRemoteOptions } from "./hocs"

/** 组件 */
export { default as FormItem } from "./components/FormItem"
export { default as FormDependency } from "./components/FormDependency"
export { default as FormGroup } from "./components/FormGroup"

/** schemx/core 导出 */
export * from "@schemx/core"
