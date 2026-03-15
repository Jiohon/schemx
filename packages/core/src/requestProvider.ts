/**
 * 全局请求器管理与请求器解析
 *
 * 提供全局请求器的注册、获取、清除，以及三级优先级请求器解析的纯函数实现。
 * 此模块不依赖任何 UI 框架，可在任意 JavaScript 环境中使用。
 *
 * 三级优先级：schema 级别 > schemx 实例级别 > 全局级别
 *
 * @module core/requestProvider
 *
 * @remarks
 * 全局请求器由 schemx.registerRequest 静态方法写入，作为三级优先级中的最低级兜底。
 * 外部通过 schemx.registerRequest / schemx.clearRequest 间接调用。
 */

/** HTTP 请求函数类型 */
export type RequestFn = (url: string) => Promise<any>

/** 包含可选 request 字段的对象接口 */
export interface HasRequest {
  request?: RequestFn
  [key: string]: any
}

let globalRequest: RequestFn | undefined = undefined

/**
 * 设置全局请求器
 *
 * @param request - HTTP 请求函数
 *
 * @remarks 内部方法，由 schemx.registerRequest 调用
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
 * @remarks 内部方法，由 schemx.clearRequest 调用，仅用于测试环境
 */
export function _clearGlobalRequest(): void {
  try {
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
      console.warn("[globalRequestProvider] clearRequest() 不应在生产环境调用")

      return
    }
  } catch {
    /* 环境不支持时优雅降级 */
  }

  globalRequest = undefined
}

/**
 * 解析请求器（纯函数版本）
 *
 * 按三级优先级依次查找可用的请求器：
 * 1. schema 级别（attrs.request）
 * 2. schemx 级别（context.request）
 * 3. 全局级别（globalRequest）
 *
 * @param attrs - schema 级别属性
 * @param context - schemx 级别上下文
 * @param globalRequest - 全局级别请求器
 * @returns 解析后的请求器函数，三级均无则返回 undefined
 *
 * @example
 * ```ts
 * const requester = resolveRequester(attrs, formContext, globalRequest)
 * ```
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
