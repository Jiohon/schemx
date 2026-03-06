/**
 * 全局请求器内部存储
 *
 * 由 SchemaForm.registerRequest 静态方法写入，useDictOptions 内部读取。
 * 作为三级优先级中的最低级兜底。
 */

type RequestFn = (url: string) => Promise<any>

let globalRequest: RequestFn | undefined = undefined

/**
 * 设置全局请求器（内部方法，由 SchemaForm.registerRequest 调用）
 */
export function _setGlobalRequest(request: RequestFn): void {
  globalRequest = request
}

/**
 * 获取全局请求器（内部方法）
 */
export function _getGlobalRequest(): RequestFn | undefined {
  return globalRequest
}

/**
 * 清除全局请求器（内部方法，由 SchemaForm.clearRequest 调用，仅测试用）
 */
export function _clearGlobalRequest(): void {
  if (import.meta.env?.PROD) {
    console.warn("[globalRequestProvider] clearRequest() 不应在生产环境调用")
    return
  }
  globalRequest = undefined
}
