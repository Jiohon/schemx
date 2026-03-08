/**
 * Hooks 统一导出
 *
 * @module hooks
 */

/** useForm - 表单状态管理 */
export { createFormInstance, useForm, type CreateFormInstanceOptions } from "./useForm"

/** useField - 单字段控制 */
export { useField, type UseFieldOptions } from "./useField"

/** useWatch - 字段变化监听 */
export {
  useWatch,
  useWatchField,
  useWatchFields,
  useWatchAll,
  type SingleFieldCallback,
  type MultiFieldCallback,
  type GlobalCallback,
  type UseWatchOptions,
} from "./useWatch"

/** useDependency - 依赖字段动态渲染 */
export { useDependency, type UseDependencyReturn } from "./useDependency"

/** useDictOptions - 远程字典选项加载 */
export {
  useDictOptions,
  type DictOptionsAttrs,
  type UseDictOptionsReturn,
} from "./useDictOptions"

/** useFormContext - 表单上下文注入与消费 */
export { useFormContext } from "./useFormContext"

/** useRenderer - 渲染器注册中心 */
export { createRenderer, useRendererContext } from "./useRenderer"

/** useRequester - 三级优先级请求器解析 */
export { resolveRequester, useRequester } from "./useRequester"
