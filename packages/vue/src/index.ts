/**
 * schemx 统一导出入口
 *
 * @module @schemx/core
 */

import "./styles/index.css"

/** 默认导出 */
export { default } from "./form"
export { default as schemxForm } from "./form"
export type { SchemxInstallOptions } from "./form"

/** 全局渲染器注册实例 */
export { rendererRegistry } from "./utils/rendererProvider"

/** 全局校验规则注册实例 */
export { rulesRegistry } from "./utils/rulesProvider"

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
  useEffect,
  type UseDependencyReturn,
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
