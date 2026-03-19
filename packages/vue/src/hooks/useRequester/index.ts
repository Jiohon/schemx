/**
 * useRequester - 三级优先级请求器解析
 *
 * 按优先级解析可用的 HTTP 请求器：
 * 1. schema 级别（attrs.request）
 * 2. schemx 级别（context.request）
 * 3. 全局级别（schemx.registerRequest）
 *
 * @module hooks/useRequester
 */

import { resolveRequester } from "@schemx/core"
import { _getGlobalRequest, type RequestFn } from "@schemx/core"

import { useFormContext } from "../useFormContext"

interface HasRequest {
  request?: RequestFn
  [key: string]: any
}

/**
 * 解析请求器（Vue 组合式 API 版本）
 *
 * 自动注入 formContext 和 globalRequest，调用方只需传入 schema 级别属性。
 *
 * @param attrs - schema 级别属性（componentProps），包含可选的 `request` 字段
 * @returns 解析后的请求器函数，三级均无则返回 undefined
 *
 * @example
 * ```ts
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
