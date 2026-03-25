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

/** useDependency - 依赖字段动态渲染 */
export { useDependency, type UseDependencyReturn } from "./useDependency"

/** useDictionary - 远程字典选项加载 */
export {
  useDictionary,
  type UseDictionaryOptions,
  type UseDictOptionsReturn,
} from "./useDictionary"

/** useContext - 表单上下文注入与消费 */
export { type FormContextProps, useContext } from "./useContext"

/** useRenderer - 渲染器注册中心 */
export { createRenderer, useRendererContext } from "./useRenderer"
