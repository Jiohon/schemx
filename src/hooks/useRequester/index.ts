/**
 * useRequester - 三级优先级请求器解析（Vue 组合式 API 版本）
 *
 * 优先级: attrs.request (column) > context.request (SchemaForm) > globalRequest (全局)
 *
 * 自动通过 useFormContext 获取 SchemaForm 级别请求器，
 * 通过 _getGlobalRequest 获取全局请求器，调用方只需传入 column 级别属性。
 *
 * @module hooks/resolveRequester
 */

import { useFormContext } from "../useFormContext"
import { _getGlobalRequest } from "./globalRequestProvider"

type RequestFn = (url: string) => Promise<any>

interface HasRequest {
  request?: RequestFn
  [key: string]: any
}

/**
 * 解析最终使用的 request 函数（组合式 API）
 *
 * 内部自动注入 formContext 和 globalRequest，调用方只需传入 column 级别属性。
 *
 * @param attrs - column 级别属性（componentProps），包含可选的 `request` 字段
 * @returns 解析后的请求器，三级均无则返回 undefined
 *
 * @example
 * ```ts
 * // 在组件 setup 中使用
 * const requester = useRequester(attrs)
 *
 * if (requester) {
 *   const data = await requester('/api/options')
 * }
 * ```
 */
export function useRequester(attrs: HasRequest): RequestFn | undefined {
  const formContext = useFormContext()
  const globalRequest = _getGlobalRequest()

  return resolveRequester(attrs, formContext, globalRequest)
}

/**
 * 解析最终使用的 request 函数（纯函数版本）
 *
 * 按三级优先级依次查找可用的请求器：
 * 1. column 级别（attrs.request）
 * 2. SchemaForm 级别（context.request）
 * 3. 全局级别（globalRequest）
 *
 * @param attrs - column 级别属性（componentProps）
 * @param context - SchemaForm 级别上下文（FormContext）
 * @param globalRequest - 全局级别请求器
 * @returns 解析后的请求器，三级均无则返回 undefined
 */
export function resolveRequester(
  attrs: HasRequest,
  context: HasRequest,
  globalRequest: RequestFn | undefined
): RequestFn | undefined {
  if (typeof attrs.request === "function") {
    return attrs.request
  }

  if (typeof context.request === "function") {
    return context.request
  }

  if (typeof globalRequest === "function") {
    return globalRequest
  }

  return undefined
}
