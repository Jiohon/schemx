/**
 * 全局请求器存储
 *
 * 由 SchemaForm.registerRequest 静态方法写入，useDictOptions 内部读取。
 * 作为三级优先级中的最低级兜底（全局 < SchemaForm 实例 < 字段级）。
 *
 * @module hooks/useRequester/globalRequestProvider
 *
 * @remarks
 * 此模块为内部实现，不直接对外暴露。
 * 外部通过 SchemaForm.registerRequest / SchemaForm.clearRequest 间接调用。
 */

type RequestFn = (url: string) => Promise<any>

let globalRequest: RequestFn | undefined = undefined

/**
 * 设置全局请求器
 *
 * @param request - HTTP 请求函数
 *
 * @remarks 内部方法，由 SchemaForm.registerRequest 调用
 */
export function _setGlobalRequest(request: RequestFn): void {
  globalRequest = request
}

/**
 * 获取全局请求器
 *
 * @returns 当前全局请求器，未注册时返回 undefined
 *
 * @remarks 内部方法，由 useRequester 调用
 */
export function _getGlobalRequest(): RequestFn | undefined {
  return globalRequest
}

/**
 * 清除全局请求器
 *
 * @remarks 内部方法，由 SchemaForm.clearRequest 调用，仅用于测试环境
 */
export function _clearGlobalRequest(): void {
  if (import.meta.env?.PROD) {
    console.warn("[globalRequestProvider] clearRequest() 不应在生产环境调用")

    return
  }

  globalRequest = undefined
}
