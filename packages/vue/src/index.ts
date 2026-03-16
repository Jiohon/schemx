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
export * from "./hooks"
export { FORM_CONTEXT_KEY } from "./hooks/useFormContext"

/** 组件 */
export { default as FormItem } from "./components/FormItem"
export { default as FormDependency } from "./components/FormDependency"

/** 工具函数 */
export { type DynamicProp, resolveDynamicProp, shouldValidateOn } from "./utils"
