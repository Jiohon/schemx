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
export { validatorRegistry } from "./utils/rulesProvider"

/** Hooks */
export {
  useConfigContext,
  useForm,
  useFormContext,
  useField,
  useFieldContext,
  useWatch,
  useWatchField,
  useWatchFields,
  useWatchAll,
  useDictionary,
  useEffect,
  type UseDictionaryReturn,
  type FormContextProps,
} from "./hooks"

/** 高阶组件 */
export { WithRemoteOptions } from "./hocs"

/** 字典选项类型 */
export type { SchemxDictionary, SchemxWithDictionary } from "./types/dictionary"

/** 组件 */
export { default as FormItem } from "./components/FormItem"
export { default as FormGroup } from "./components/FormGroup"

/** schemx/core 导出 */
export * from "@schemx/core"
