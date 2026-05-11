/**
 * Hooks 统一导出
 *
 * @module hooks
 */

/** useForm - 表单状态管理 */
export { useForm } from "./useForm"

/** useField - 单字段控制 */
export { useField } from "./useField"

/** useWatch - 字段变化监听 */
export { useWatch, useWatchField, useWatchFields, useWatchAll } from "./useWatch"

/** useEffect - 通用 Signal effect */
export { useEffect } from "./useEffect"

/** useDictionary - 字典选项加载 */
export {
  useDictionary,
  type SchemxDictionary,
  type SchemxWithDictionary,
  type UseDictOptionsReturn,
} from "./useDictionary"

/** useContext - 表单上下文注入与消费 */
export { type FormContextProps, useContext } from "./useContext"

/** useStableRef - 引用稳定化的 shallowRef */
export { useStableRef } from "./useStableRef"

/** useDependencies - 依赖属性解析 */
export { useDependencies } from "./useDependencies"

/** useResolvedSchemas - resolved schema projection Vue 桥接 */
export { useResolvedSchemas } from "./useResolvedSchemas"

/** useFieldHandler - 字段处理 */
export { useFieldHandler, type UseFieldHandlerReturn } from "./useFieldHandler"

/** useFieldContext - 字段上下文注入与消费 */
export { useFieldContext } from "./useFieldContext"
